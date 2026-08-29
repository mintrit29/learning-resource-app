import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import path from "node:path";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

async function findFreePort() {
  const probe = net.createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const address = probe.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve, reject) => {
    probe.close((error) => error ? reject(error) : resolve());
  });
  return port;
}

async function waitForReady(origin, logs, expectedStatus = "ready") {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${origin}/health`).catch(() => null);
    if (response?.ok) {
      const health = await response.json();
      if (health.status === expectedStatus) return health;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Embedding runtime did not become ready:\n${logs.join("\n")}`);
}

// A real service with an empty disposable cache must stay available without downloading.
const missingCache = await mkdtemp(path.join(tmpdir(), "scholarflow-missing-bge-"));
const missingPort = await findFreePort();
const missingOrigin = `http://127.0.0.1:${missingPort}`;
const missingLogs = [];
const missingChild = spawn(process.execPath, [path.resolve("embedding-runtime/service.mjs")], {
  env: { ...process.env, EMBEDDING_PORT: String(missingPort), SCHOLARFLOW_EMBEDDING_MOCK: "0", SCHOLARFLOW_MODEL_CACHE: missingCache },
  stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
});
missingChild.stdout.on("data", data => missingLogs.push(String(data)));
missingChild.stderr.on("data", data => missingLogs.push(String(data)));
try {
  const health = await waitForReady(missingOrigin, missingLogs, "missing");
  assert.notEqual(health.backend, "mock");
  const response = await fetch(`${missingOrigin}/embed`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ texts: ["Tài liệu kiểm thử"] }),
  });
  assert.equal(response.status, 503);
  assert.match((await response.json()).detail, /BGE-M3 chưa được cài đặt/);
  assert.equal((await fetch(`${missingOrigin}/health`)).status, 200);
  assert.deepEqual(await readdir(missingCache), [], "Missing model must not populate the cache automatically");
  console.log("PASS missing BGE: real service listens, embed returns friendly 503, health stays available, empty cache unchanged");
} finally {
  if (missingChild.exitCode === null) {
    const exit = once(missingChild, "exit");
    missingChild.kill();
    await exit;
  }
  assert.ok(path.basename(missingCache).startsWith("scholarflow-missing-bge-"));
  await rm(missingCache, { recursive: true, force: true });
}

const port = await findFreePort();
const origin = `http://127.0.0.1:${port}`;
const serviceEntry = path.resolve("embedding-runtime", "service.mjs");
const logs = [];
const child = spawn(process.execPath, [serviceEntry], {
  env: {
    ...process.env,
    EMBEDDING_PORT: String(port),
    SCHOLARFLOW_EMBEDDING_MOCK: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
child.stdout.on("data", (chunk) => logs.push(String(chunk).trimEnd()));
child.stderr.on("data", (chunk) => logs.push(String(chunk).trimEnd()));

try {
  const health = await waitForReady(origin, logs);
  assert.equal(health.backend, "mock");
  assert.equal(health.dimensions, 1024);
  assert.equal((await fetch(origin + "/transcribe?mode=voice", { method: "POST" })).status, 410);
  assert.equal((await fetch(origin + "/transcribe", { method: "POST", headers: { "x-audio-extension": "webm" }, body: "not audio" })).status, 415);

  const response = await fetch(`${origin}/embed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ texts: ["ScholarFlow", "Tài liệu học máy"] }),
  });
  const responseBody = await response.text();
  assert.equal(response.status, 200, responseBody);
  const result = JSON.parse(responseBody);
  assert.equal(result.embeddings.length, 2);
  assert.equal(result.embeddings[0].length, 1024);
  const norm = Math.sqrt(result.embeddings[0].reduce((sum, value) => sum + value * value, 0));
  assert.ok(Math.abs(norm - 1) < 1e-6);
  console.log("PASS local embedding runtime: lifecycle, health and 1024-dimensional vectors");
} finally {
  if (child.exitCode === null && child.pid) {
    child.kill("SIGTERM");
    const exited = await Promise.race([
      once(child, "exit").then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
    ]);
    if (!exited && process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else if (!exited) {
      child.kill("SIGKILL");
    }
  }
}
