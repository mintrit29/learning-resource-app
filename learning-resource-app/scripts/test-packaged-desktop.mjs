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
        const response = await fetch(`${origin}/register`).catch(() => null);
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
}

try {
  child = spawn(executable, [], {
    env: childEnvironment,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.on("data", (chunk) => processLogs.push(String(chunk).trimEnd()));
  child.stderr.on("data", (chunk) => processLogs.push(String(chunk).trimEnd()));
  const origin = await waitForApplication();

  const registration = await fetch(`${origin}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Packaged Smoke",
      email: "packaged-smoke@example.test",
      password: "ScholarFlow!123",
    }),
  });
  assert.equal(registration.status, 201, await registration.text());

  const databasePath = path.join(userDataRoot, "data", "scholarflow.db");
  const database = new Database(databasePath, { readonly: true });
  try {
    assert.equal(database.prepare('SELECT count(*) AS count FROM "User"').get().count, 1);
  } finally {
    database.close();
  }
  assert.equal(child.exitCode, null, "Desktop main process must stay alive after startup");

  console.log("PASS packaged desktop: app window runtime, fresh local database and registration");
} finally {
  stopApplication();
  await rm(userDataRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
