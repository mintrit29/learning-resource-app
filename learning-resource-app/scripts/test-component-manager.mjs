import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { COMPONENT_MANIFESTS, ComponentManager, safeJoin } = require("../electron/component-manager.cjs");
const payload = Buffer.from("ScholarFlow component download test\n".repeat(4096));
const sha256 = createHash("sha256").update(payload).digest("hex");
const temporary = await mkdtemp(path.join(tmpdir(), "scholarflow-components-"));
let rangeRequests = 0;
let assetRequests = 0;
let ignoreRange = false;

const server = createServer((request, response) => {
  if (request.url === "/slow") {
    response.writeHead(200);
    response.write(payload.subarray(0, 100));
    setTimeout(() => response.end(payload.subarray(100)), 500);
    return;
  }
  assetRequests += 1;
  const range = request.headers.range;
  if (range && !ignoreRange) {
    rangeRequests += 1;
    const offset = Number(range.match(/bytes=(\d+)-/)?.[1] || 0);
    response.writeHead(206, {
      "content-length": payload.length - offset,
      "content-range": `bytes ${offset}-${payload.length - 1}/${payload.length}`,
    });
    response.end(payload.subarray(offset));
    return;
  }
  response.writeHead(200, { "content-length": payload.length });
  response.end(payload);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const origin = `http://127.0.0.1:${address.port}`;

try {
  assert.deepEqual(Object.keys(COMPONENT_MANIFESTS).sort(), ["bge-m3", "docling"]);
  assert.equal(COMPONENT_MANIFESTS["bge-m3"].files.length, 5);
  assert.equal(
    COMPONENT_MANIFESTS.docling.archive.url,
    "https://github.com/bblanchon/pdfium-binaries/releases/download/chromium%2F7961/pdfium-win-x64.tgz",
  );
  assert.equal(COMPONENT_MANIFESTS.docling.archive.size, 7220736);
  assert.equal(COMPONENT_MANIFESTS.docling.archive.sha256, "d3d9f4b7c9dabe3363f30779c5c3c715c47332749fa590e4b4a2b8b6780cb1c4");
  assert.throws(() => safeJoin(temporary, "../outside"), /ngoài vùng dữ liệu/);

  const manager = new ComponentManager({ userDataRoot: temporary });
  assert.equal(manager.quickState("bge-m3").status, "missing");
  const partialModel = path.join(manager.rootFor("bge-m3"), "config.json");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(path.dirname(partialModel), { recursive: true }));
  writeFileSync(partialModel, Buffer.alloc(687));
  assert.equal(manager.quickState("bge-m3").status, "corrupt");
  manager.getFreeBytes = async () => 0;
  await assert.rejects(manager.install("docling"), /Không đủ dung lượng/);
  manager.getFreeBytes = ComponentManager.prototype.getFreeBytes.bind(manager);
  const expected = { relativePath: "fixture.bin", size: payload.length, sha256 };
  const fresh = path.join(temporary, "fresh.bin");
  await manager.downloadFile(`${origin}/asset`, fresh, expected, new AbortController().signal, () => {});
  assert.deepEqual(readFileSync(fresh), payload);

  const requestsBeforeCachedFile = assetRequests;
  await manager.downloadFile(`${origin}/asset`, fresh, expected, new AbortController().signal, () => {});
  assert.equal(assetRequests, requestsBeforeCachedFile, "A verified existing asset must not be downloaded again");

  const resumed = path.join(temporary, "resumed.bin");
  writeFileSync(`${resumed}.partial`, payload.subarray(0, 321));
  await manager.downloadFile(`${origin}/asset`, resumed, expected, new AbortController().signal, () => {});
  assert.equal(rangeRequests, 1);
  assert.deepEqual(readFileSync(resumed), payload);

  ignoreRange = true;
  const restarted = path.join(temporary, "restarted.bin");
  writeFileSync(`${restarted}.partial`, payload.subarray(0, 111));
  await manager.downloadFile(`${origin}/asset`, restarted, expected, new AbortController().signal, () => {});
  assert.deepEqual(readFileSync(restarted), payload);

  await assert.rejects(
    manager.downloadFile(`${origin}/asset`, path.join(temporary, "bad.bin"), { ...expected, sha256: "0".repeat(64) }, new AbortController().signal, () => {}),
    /Checksum không đúng/,
  );
  assert.equal(existsSync(path.join(temporary, "bad.bin")), false);
  const controller = new AbortController();
  const cancelled = manager.downloadFile(`${origin}/slow`, path.join(temporary, "cancelled.bin"), expected, controller.signal, () => {});
  setTimeout(() => controller.abort(), 30);
  await assert.rejects(cancelled, /hủy tải|aborted|socket hang up/i);
  assert.equal(existsSync(path.join(temporary, "cancelled.bin")), false);
  console.log("PASS component manager: states, disk check, containment, downloads, Range resume, cancellation and checksum");
} finally {
  server.close();
  await rm(temporary, { recursive: true, force: true });
}
