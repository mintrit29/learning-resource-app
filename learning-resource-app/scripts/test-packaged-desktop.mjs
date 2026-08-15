import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

const executable = path.resolve("dist-electron", "win-unpacked", "ScholarFlow.exe");
assert.ok(existsSync(executable), "Package the desktop app before this smoke test");
const packagedTransformers = path.resolve(
  "dist-electron",
  "win-unpacked",
  "resources",
  "embedding-runtime",
  "node_modules",
  "@huggingface",
  "transformers",
  "package.json",
);
assert.ok(existsSync(packagedTransformers), "Packaged app must include the local embedding runtime");

const userDataRoot = await mkdtemp(path.join(tmpdir(), "scholarflow-packaged-"));
const logPath = path.join(userDataRoot, "logs", "desktop.log");
const childEnvironment = {
  ...process.env,
  SCHOLARFLOW_USER_DATA_ROOT: userDataRoot,
  SCHOLARFLOW_EMBEDDING_MOCK: "1",
};
childEnvironment.ELECTRON_ENABLE_LOGGING = "1";
delete childEnvironment.ELECTRON_RUN_AS_NODE;
let child;
const processLogs = [];

async function waitForApplication() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child?.exitCode !== null) {
      const log = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
      throw new Error(`Packaged app exited before it was ready:\n${log}\n${processLogs.join("\n")}`);
    }

    if (existsSync(logPath)) {
      const log = readFileSync(logPath, "utf8");
      const origins = [...log.matchAll(/http:\/\/127\.0\.0\.1:\d+/g)].map((match) => match[0]);
      const origin = origins.at(-1);
      if (origin) {
        const response = await fetch(`${origin}/dashboard`).catch(() => null);
        if (response?.ok) return origin;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  const log = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
  throw new Error(`Packaged app did not become ready:\n${log}`);
}

function stopApplication() {
  if (!child || child.exitCode !== null || !child.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } else {
    child.kill("SIGTERM");
  }
  child.stdout?.destroy();
  child.stderr?.destroy();
  child.unref();
}

function readEmbeddingOrigin() {
  if (!existsSync(logPath)) return null;
  const log = readFileSync(logPath, "utf8");
  return [...log.matchAll(/local BGE-M3 tại (http:\/\/127\.0\.0\.1:\d+)/g)].at(-1)?.[1] ?? null;
}

function findListeningProcessId(origin) {
  const port = new URL(origin).port;
  const result = spawnSync("netstat.exe", ["-ano", "-p", "tcp"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const match = result.stdout
    .split(/\r?\n/)
    .find((line) => line.includes(`127.0.0.1:${port}`) && line.includes("LISTENING"))
    ?.trim()
    .match(/\s(\d+)$/);
  const processId = Number(match?.[1]);
  return Number.isInteger(processId) && processId > 0 ? processId : null;
}

async function verifyEmbeddingAutoRestart() {
  const embeddingOrigin = readEmbeddingOrigin();
  assert.ok(embeddingOrigin, "Packaged app must log the local embedding origin");
  const embeddingPid = findListeningProcessId(embeddingOrigin);
  assert.ok(embeddingPid, "Packaged embedding runtime must be listening");

  const readyBefore = (readFileSync(logPath, "utf8").match(/ready model=/g) ?? []).length;
  process.kill(embeddingPid, "SIGTERM");

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const log = readFileSync(logPath, "utf8");
    const readyNow = (log.match(/ready model=/g) ?? []).length;
    if (readyNow > readyBefore && log.includes("Embedding runtime đã tự khôi phục.")) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Embedding runtime did not restart:\n${readFileSync(logPath, "utf8")}`);
}

try {
  // The isolated Windows test account cannot load Chromium's GPU child DLLs.
  // Keep this workaround test-only so the released app retains process isolation.
  child = spawn(executable, ["--in-process-gpu"], {
    env: childEnvironment,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.on("data", (chunk) => processLogs.push(String(chunk).trimEnd()));
  child.stderr.on("data", (chunk) => processLogs.push(String(chunk).trimEnd()));
  const origin = await waitForApplication();

  const dashboard = await fetch(`${origin}/dashboard`);
  assert.equal(dashboard.status, 200, await dashboard.text());

  const databasePath = path.join(userDataRoot, "data", "scholarflow.db");
  const database = new Database(databasePath, { readonly: true });
  try {
    assert.equal(database.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('User', 'Account', 'Session', 'VerificationToken')").get().count, 0);
    assert.equal(database.prepare('SELECT count(*) AS count FROM "Tag"').get().count, 27);
  } finally {
    database.close();
  }
  assert.equal(child.exitCode, null, "Desktop main process must stay alive after startup");
  await verifyEmbeddingAutoRestart();
  assert.equal(child.exitCode, null, "Desktop main process must survive an embedding restart");

  console.log("PASS packaged desktop: local-only startup, credential-free database and embedding auto-restart");
} finally {
  stopApplication();
  // Windows may keep Chromium cache files locked briefly after taskkill returns.
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  await rm(userDataRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 }).catch((error) => {
    if (error?.code === "EBUSY" || error?.code === "EPERM") {
      console.warn(`WARN packaged desktop: Windows kept temporary cache locked at ${userDataRoot}`);
      return;
    }
    throw error;
  });
}

process.exit(0);
