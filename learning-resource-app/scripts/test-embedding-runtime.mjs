import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import path from "node:path";

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

async function waitForReady(origin, logs) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${origin}/health`).catch(() => null);
    if (response?.ok) {
      const health = await response.json();
      if (health.status === "ready") return health;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Embedding runtime did not become ready:\n${logs.join("\n")}`);
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
