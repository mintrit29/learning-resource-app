import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

const executable = path.resolve("dist-electron", "win-unpacked", "ScholarFlow.exe");
assert.ok(existsSync(executable), "Package the desktop app before this smoke test");
const packagedAppRoot = path.resolve("dist-electron", "win-unpacked", "resources", "app");
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

async function verifyPackagedTesseractDependencies() {
  const probePath = path.join(userDataRoot, "probe-tesseract.cjs");
  const setImagePath = path.join(
    packagedAppRoot,
    "node_modules",
    "tesseract.js",
    "src",
    "worker-script",
    "utils",
    "setImage.js",
  );
  assert.ok(existsSync(setImagePath), "Packaged app must include the Tesseract worker");
  await writeFile(probePath, `require(${JSON.stringify(setImagePath)});\n`, "utf8");
  const probe = spawnSync(executable, [probePath], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(
    probe.status,
    0,
    `Packaged Tesseract dependency probe failed:\n${probe.stdout}\n${probe.stderr}`,
  );
}

async function verifyProviderPersistence(origin) {
  const providerName = "Packaged Custom API";
  const response = await fetch(`${origin}/api/ai-providers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "CUSTOM",
      displayName: providerName,
      baseUrl: "http://127.0.0.1:39999/v1",
      apiKey: "packaged-test-key",
      defaultChatModel: "packaged-test-model",
      isActive: true,
    }),
  });
  assert.equal(response.status, 201, await response.text());
  const settings = await fetch(`${origin}/settings/ai-providers`);
  const html = await settings.text();
  assert.equal(settings.status, 200, html);
  assert.match(html, new RegExp(providerName), "Saved Custom API must remain visible after reopening settings");
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
  await verifyPackagedTesseractDependencies();
  await verifyProviderPersistence(origin);

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

  console.log("PASS packaged desktop: startup, provider persistence, Tesseract dependencies and embedding auto-restart");
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
