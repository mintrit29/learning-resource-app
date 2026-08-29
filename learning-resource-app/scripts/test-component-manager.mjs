import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { COMPONENT_MANIFESTS, ComponentManager, safeJoin, sha256File } = require("../electron/component-manager.cjs");
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
  assert.deepEqual(Object.keys(COMPONENT_MANIFESTS).sort(), ["bge-m3", "docling", "whisper-small"]);
  assert.equal(COMPONENT_MANIFESTS["bge-m3"].files.length, 5);
  assert.equal(COMPONENT_MANIFESTS["whisper-small"].optional, true);
  assert.equal(COMPONENT_MANIFESTS["whisper-small"].files.length, 8);
  assert.equal(COMPONENT_MANIFESTS["whisper-small"].version, "36050c4+silero-867c2aa");
  const vadAsset = COMPONENT_MANIFESTS["whisper-small"].files.find(file => file.relativePath === "vad/silero_vad.onnx");
  assert.equal(vadAsset.size, 2327524);
  assert.equal(vadAsset.sha256, "1a153a22f4509e292a94e67d6f9b85e8deb25b4988682b7e174c65279d8788e3");
  assert.ok(vadAsset.url.includes("/867c2aa692646a1f1de3e94a15c9dd9f614c0acb/"));
  assert.equal(COMPONENT_MANIFESTS.whisper, undefined, "Voice model is no longer installable");
  for (const file of COMPONENT_MANIFESTS["whisper-small"].files.filter(file => !file.relativePath.startsWith("vad/"))) {
    assert.match(file.url, /^https:\/\/huggingface\.co\/onnx-community\/whisper-small\/resolve\/36050c46d777d46dc4b5f43f6d90574fc38f8732\//);
    assert.match(file.sha256, /^[a-f0-9]{64}$/);
    assert.ok(file.size > 0);
  }
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
  // Cancellation must also stop local hashing, not only network downloads.
  const hashAbort = new AbortController();
  const pendingHash = sha256File(fresh, hashAbort.signal);
  hashAbort.abort();
  await assert.rejects(pendingHash, /abort/i);
  assert.equal(await sha256File(fresh), sha256);
  const verifyEvents = [];
  let cancelVerification = true;
  const cancellable = new ComponentManager({ userDataRoot: temporary, onProgress: (event) => {
    verifyEvents.push(event);
    if (cancelVerification && event.status === "verifying") cancellable.cancel(event.id);
  } });
  // Cancel at the first progress event, before invalid fixture files are examined.
  const previousState = cancellable.quickState("bge-m3").status;
  const stopped = await cancellable.verify("bge-m3");
  assert.equal(stopped.status, previousState);
  assert.equal(cancellable.operations.size, 0);
  assert.equal(existsSync(cancellable.corruptMarkerFor("bge-m3")), false);
  assert.equal(verifyEvents.at(-1).error, "Đã hủy kiểm tra");
  assert.ok(existsSync(partialModel));
  cancelVerification = false;
  await assert.rejects(cancellable.verify("bge-m3"), /File không hợp lệ/);
  assert.equal(cancellable.quickState("bge-m3").status, "corrupt");
  const installEvents = [];
  const cancelInstall = new ComponentManager({ userDataRoot: temporary, onProgress: (event) => {
    installEvents.push(event);
    if (event.status === "downloading") cancelInstall.cancel(event.id);
  } });
  cancelInstall.getFreeBytes = async () => Number.MAX_SAFE_INTEGER;
  const stoppedInstall = await cancelInstall.install("whisper-small");
  assert.equal(stoppedInstall.status, "missing");
  assert.equal(cancelInstall.operations.size, 0);
  assert.equal(installEvents.at(-1).status, "missing", "Cancellation must not leave the UI downloading");
  console.log("PASS cancellation: hashing, verification, preserved files/markers, retry, install final state");
  console.log("PASS component manager: states, disk check, containment, downloads, Range resume, cancellation and checksum");

  // Exercise deletion only inside this test's disposable root, never the user's models.
  const librarySentinel = path.join(temporary, "data", "library-sentinel.txt");
  mkdirSync(path.dirname(librarySentinel), { recursive: true });
  writeFileSync(librarySentinel, "preserve library");
  const changed = [];
  let busy = true;
  const removal = new ComponentManager({
    userDataRoot: temporary,
    canRemove: async () => !busy,
    onModelChanged: async (id) => changed.push(id),
  });
  await assert.rejects(removal.remove("bge-m3"), /tài liệu đang được xử lý/);
  assert.ok(existsSync(partialModel), "Busy guard must preserve existing model files");
  busy = false;
  removal.operations.set("bge-m3", { snapshot: { status: "verifying" } });
  await assert.rejects(removal.remove("bge-m3"), /Thành phần đang được xử lý/);
  removal.operations.delete("bge-m3");
  for (const id of Object.keys(COMPONENT_MANIFESTS)) {
    const componentRoot = removal.rootFor(id);
    assert.ok(componentRoot.startsWith(`${path.resolve(temporary)}${path.sep}`));
    mkdirSync(componentRoot, { recursive: true });
    writeFileSync(path.join(componentRoot, "test-only.partial"), "incomplete model");
    await assert.rejects(removal.verify(id), /File không hợp lệ/);
    assert.equal(removal.quickState(id).status, "corrupt");
    assert.equal((await removal.remove(id)).status, "missing");
    assert.equal(existsSync(componentRoot), false);
    assert.equal(readFileSync(librarySentinel, "utf8"), "preserve library");
  }
  assert.deepEqual(changed, ["bge-m3", "whisper-small"]);
  await assert.rejects(removal.remove("../data"), /Thành phần không hợp lệ/);
  assert.equal(removal.cancel("docling"), false);
  console.log("PASS component removal: busy/job guards, corrupt verification, all three roots removed, runtime callbacks, library preserved");
} finally {
  server.close();
  await rm(temporary, { recursive: true, force: true });
}
