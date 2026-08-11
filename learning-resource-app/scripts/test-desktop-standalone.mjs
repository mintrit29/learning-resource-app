import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";

import Database from "better-sqlite3";

const projectRoot = process.cwd();
const standaloneRoot = process.env.SCHOLARFLOW_STANDALONE_ROOT
  ? path.resolve(process.env.SCHOLARFLOW_STANDALONE_ROOT)
  : path.join(projectRoot, ".next", "standalone");
const runtimeBinary = process.env.SCHOLARFLOW_RUNTIME_BINARY
  ? path.resolve(process.env.SCHOLARFLOW_RUNTIME_BINARY)
  : process.execPath;
const serverEntry = path.join(standaloneRoot, "server.js");
assert.ok(existsSync(serverEntry), "Run npm run desktop:build before this smoke test");

const dataRoot = await mkdtemp(path.join(tmpdir(), "scholarflow-desktop-runtime-"));
const databasePath = path.join(dataRoot, "scholarflow.db");
const healthToken = "desktop-runtime-smoke-token";
const logs = [];
let child;

async function findFreePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  server.close();
  await once(server, "close");
  return port;
}

async function waitUntilReady(url) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${url}/api/health`, {
      headers: { "x-scholarflow-health-token": healthToken },
    }).catch(() => null);
    if (response?.ok) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Standalone server did not become ready:\n${logs.slice(-20).join("\n")}`);
}

async function stopChild() {
  if (!child || child.exitCode !== null) return;
  const pid = child.pid;
  child.kill("SIGTERM");
  const exited = await Promise.race([
    once(child, "exit").then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);
  if (!exited && process.platform === "win32" && pid) {
    spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } else if (!exited) {
    child.kill("SIGKILL");
  }
}

try {
  const port = await findFreePort();
  const origin = `http://127.0.0.1:${port}`;
  child = spawn(runtimeBinary, [serverEntry], {
    cwd: standaloneRoot,
    env: {
      ...process.env,
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      NODE_ENV: "production",
      AUTH_URL: origin,
      NEXTAUTH_URL: origin,
      AUTH_TRUST_HOST: "true",
      AUTH_SECRET: "desktop-runtime-smoke-auth-secret-with-enough-entropy",
      SCHOLARFLOW_DESKTOP: "1",
      SCHOLARFLOW_DATA_ROOT: dataRoot,
      SCHOLARFLOW_HEALTH_TOKEN: healthToken,
      DATABASE_URL: `file:${databasePath.replaceAll("\\", "/")}`,
      ...(process.env.SCHOLARFLOW_RUNTIME_BINARY ? { ELECTRON_RUN_AS_NODE: "1" } : {}),
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.on("data", (chunk) => logs.push(String(chunk).trimEnd()));
  child.stderr.on("data", (chunk) => logs.push(String(chunk).trimEnd()));

  await waitUntilReady(origin);
  const registration = await fetch(`${origin}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Desktop Smoke",
      email: "desktop-smoke@example.test",
      password: "ScholarFlow!123",
    }),
  });
  assert.equal(
    registration.status,
    201,
    `Registration failed: ${await registration.text()}\n${logs.slice(-20).join("\n")}`,
  );

  const database = new Database(databasePath, { readonly: true });
  try {
    assert.equal(database.prepare('SELECT count(*) AS count FROM "User"').get().count, 1);
    assert.equal(database.prepare('SELECT count(*) AS count FROM "Tag"').get().count, 27);
    assert.equal(
      database.prepare('SELECT count(*) AS count FROM "Tag" WHERE "isClassificationEnabled" = 1').get().count,
      27,
    );
    assert.equal(
      database.prepare('SELECT count(*) AS count FROM "Tag" WHERE "description" LIKE ?').get("NTTU · Học kỳ 1 ·%").count,
      0,
      "Semester 1 subjects must not be seeded",
    );
    assert.ok(
      database.prepare('SELECT "curriculumInitializedAt" FROM "User" LIMIT 1').get().curriculumInitializedAt,
      "The curriculum must be marked as initialized",
    );
    assert.equal(
      database.prepare('SELECT count(*) AS count FROM "_ScholarFlowMigration"').get().count,
      2,
    );
  } finally {
    database.close();
  }

  console.log("PASS desktop standalone: fresh SQLite migration, health check and registration");
} finally {
  await stopChild();
  await rm(dataRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
