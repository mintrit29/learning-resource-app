/* eslint-disable @typescript-eslint/no-require-imports */

const { createHash } = require("node:crypto");
const { spawn } = require("node:child_process");
const {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
  copyFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} = require("node:fs");
const { statfs } = require("node:fs/promises");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");

const BGE_REVISION = "6a3fd5fa10d7c4e4fabeace29e36b2bfa76d45d5";
const DOCLING_RELEASE = "models-v1";
const PDFIUM_RELEASE = "152.0.7961.0";
const PDFIUM_REVISION = "7961";
const TESSDATA_RELEASE = "4.1.0";
const WHISPER_SMALL_REVISION = "36050c46d777d46dc4b5f43f6d90574fc38f8732";
const HF_BASE = `https://huggingface.co/BAAI/bge-m3/resolve/${BGE_REVISION}`;
const WHISPER_SMALL_BASE = `https://huggingface.co/onnx-community/whisper-small/resolve/${WHISPER_SMALL_REVISION}`;
const DOCLING_BASE = `https://github.com/docling-project/docling.rs/releases/download/${DOCLING_RELEASE}`;
const TESSDATA_BASE = `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/${TESSDATA_RELEASE}`;

const COMPONENT_MANIFESTS = Object.freeze({
  "bge-m3": Object.freeze({
    id: "bge-m3",
    name: "BGE-M3",
    version: BGE_REVISION.slice(0, 7),
    relativeRoot: path.join("models", "BAAI", "bge-m3"),
    files: [
      ["config.json", 687, "26159e7ad065073448460117eb24b7a4572f6f4e78eadff65dc0a11c052449fa"],
      ["tokenizer.json", 17098108, "21106b6d7dab2952c1d496fb21d5dc9db75c28ed361a05f5020bbba27810dd08"],
      ["tokenizer_config.json", 444, "a62b2b6784f990259fddef5f16388693a8043be4f69179e6a5257eeb3f9abac4"],
      ["onnx/model.onnx", 724923, "f84251230831afb359ab26d9fd37d5936d4d9bb5d1d5410e66442f630f24435b"],
      ["onnx/model.onnx_data", 2266820608, "1eebfb28493f67bba03ce0ef64bfdc7fc5a3bd9d7493f818bb1d78cd798416b4"],
    ].map(([relativePath, size, sha256]) => ({
      relativePath, size, sha256, url: `${HF_BASE}/${relativePath}`,
    })),
  }),
  docling: Object.freeze({
    id: "docling",
    name: "Docling",
    version: `${DOCLING_RELEASE}+vie-eng-${TESSDATA_RELEASE}+pdfium-${PDFIUM_RELEASE}`,
    relativeRoot: path.join("runtimes", "docling"),
    files: [
      ["models/layout_heron.onnx", 172208540, "2e5d4dd812c46b742a031611ab7ba061bf66937a56fdee266ada4fe1e3073764", "layout_heron.onnx"],
      ["models/layout_heron_int8.onnx", 68543846, "5c7a4685c838b485069b81847f2c9330f7ffc488aefff7a8ceb7f7968c95e410", "layout_heron_int8.onnx"],
      ["models/ocr_rec.onnx", 10690752, "897a3ededb38fee0dae2c1ccee38241f37df202c9509e3abca02e9217c5ee615", "ocr_rec.onnx"],
      ["models/picture_classifier.onnx", 16940439, "27ffc48c27ae4e12c99b6f6de0dd730005245e47b70dd0c1339e62cbac3ec4c0", "picture_classifier.onnx"],
      ["models/ppocr_keys_v1.txt", 26250, "a1c84d9bdb9ab29043c58896224d32941783eb821629618416dcb08f12886492", "ppocr_keys_v1.txt"],
      ["models/tesseract/vie.traineddata", 531275, "79df64caf7bcfb2a27df5042ecb6121e196eada34da774956995747636d5bfa1", null, `${TESSDATA_BASE}/vie.traineddata`],
      ["models/tesseract/eng.traineddata", 4113088, "7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2", null, `${TESSDATA_BASE}/eng.traineddata`],
      ["models/tableformer/bbox.onnx", 52110, "65247bba792830762c89baa5f2e5f06c8df7720181e4d0088107f7d88b06f915", "bbox.onnx"],
      ["models/tableformer/bbox.onnx.data", 39649280, "7610e2593bfaecd72a535370f06e8c2468f9bf208bd2abe46cc727dda0a11392", "bbox.onnx.data"],
      ["models/tableformer/decoder.onnx", 432917, "40e9fc2f2878cfbf25ede41e5557eeb9ef091c43c0d7176baa54d01c0b477c34", "decoder.onnx"],
      ["models/tableformer/decoder.onnx.data", 77856768, "f497d191f3907a2dd0ac9b4a2562e8f52c60f7657a1a714f5a8c4e855f3e39ef", "decoder.onnx.data"],
      ["models/tableformer/decoder_kv.onnx", 372464, "295e452480e6eddb4ae8972dfff939c1a6a3293bfd8b30fe026c3d7d6ee92037", "decoder_kv.onnx"],
      ["models/tableformer/decoder_kv.onnx.data", 115605504, "7d60a29e01f66108d36075be51c012ff451e70aba83c644a1b59604395f13c10", "decoder_kv.onnx.data"],
      ["models/tableformer/encoder.onnx", 225842279, "790cb70168e66fcf77136fdd3ba6d0ff527ee366e083e62475e0339a5c811e00", "encoder.onnx"],
    ].map(([relativePath, size, sha256, sourceName, sourceUrl]) => ({
      relativePath, size, sha256, url: sourceUrl || `${DOCLING_BASE}/${sourceName}`,
    })),
    archive: {
      url: `https://github.com/bblanchon/pdfium-binaries/releases/download/chromium%2F${PDFIUM_REVISION}/pdfium-win-x64.tgz`,
      relativePath: "pdfium/lib/pdfium.dll",
      size: 7220736,
      sha256: "d3d9f4b7c9dabe3363f30779c5c3c715c47332749fa590e4b4a2b8b6780cb1c4",
    },
  }),
  "whisper-small": Object.freeze({
    id: "whisper-small",
    name: "Whisper Small + VAD",
    version: `${WHISPER_SMALL_REVISION.slice(0, 7)}+silero-867c2aa`,
    optional: true,
    relativeRoot: path.join("models", "onnx-community", "whisper-small"),
    files: [
      ["config.json", 2227, "457854d452f17661e197d74aee12b8e74fb75ba30ebfaa7426d0d61ea1e08a18"],
      ["generation_config.json", 3893, "f538b28220c6a6d6f1af1458d4141cacb4ef4963df3de98a19490440c412ddf0"],
      ["preprocessor_config.json", 339, "a6a76d28c93edb273669eb9e0b0636a2bddbb1272c3261e47b7ca6dfdbac1b8d"],
      ["tokenizer.json", 2480466, "27fc476bfe7f17299480be2273fc0608e4d5a99aba2ab5dec5374b4482d1a566"],
      ["tokenizer_config.json", 282683, "2a4c4281cf9f51ac6ccc406fdc711a087afe6530f671fa7b80953edc498275ce"],
      ["onnx/encoder_model_quantized.onnx", 92326160, "a43a83f3c5361cd591cfa7c36f14b43cf7cb22f47a415cc14a8d557be800fa92"],
      ["onnx/decoder_model_merged_quantized.onnx", 156750845, "ec07c3cbb64172c39791e26ee870a65ac22b458c36722bfe2776b3dbf741e0c9"],
    ].map(([relativePath, size, sha256]) => ({
      relativePath, size, sha256, url: `${WHISPER_SMALL_BASE}/${relativePath}`,
    })).concat([{
      relativePath: "vad/silero_vad.onnx", size: 2327524,
      sha256: "1a153a22f4509e292a94e67d6f9b85e8deb25b4988682b7e174c65279d8788e3",
      url: "https://raw.githubusercontent.com/snakers4/silero-vad/867c2aa692646a1f1de3e94a15c9dd9f614c0acb/src/silero_vad/data/silero_vad.onnx",
    }]),
  }),
});

function assertComponentId(id) {
  const manifest = COMPONENT_MANIFESTS[id];
  if (!manifest) throw new Error("Thành phần không hợp lệ");
  return manifest;
}

function safeJoin(root, relativePath) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(root, relativePath);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("Đường dẫn thành phần nằm ngoài vùng dữ liệu");
  }
  return resolved;
}

function sha256File(filePath, signal) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath, { signal });
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("error", reject);
    stream.once("end", () => resolve(hash.digest("hex")));
  });
}

function copyTree(source, destination) {
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(destinationPath, { recursive: true });
      copyTree(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      mkdirSync(path.dirname(destinationPath), { recursive: true });
      copyFileSync(sourcePath, destinationPath);
    }
  }
}

class ComponentManager {
  constructor({ userDataRoot, legacyDoclingRoots = [], onProgress = () => {}, onModelChanged = async () => {}, onBgeChanged, canRemove = async () => true }) {
    this.userDataRoot = path.resolve(userDataRoot);
    this.legacyDoclingRoots = legacyDoclingRoots.map((candidate) => path.resolve(candidate));
    this.onProgress = onProgress;
    this.onModelChanged = onBgeChanged || onModelChanged;
    this.canRemove = canRemove;
    this.operations = new Map();
    mkdirSync(this.userDataRoot, { recursive: true });
  }

  rootFor(id) {
    return safeJoin(this.userDataRoot, assertComponentId(id).relativeRoot);
  }

  markerFor(id) {
    return safeJoin(this.rootFor(id), ".component.json");
  }

  corruptMarkerFor(id) {
    return safeJoin(this.rootFor(id), ".component-corrupt");
  }

  totalBytes(manifest) {
    return manifest.files.reduce((sum, file) => sum + file.size, 0) + (manifest.archive?.size || 0);
  }

  async getFreeBytes() {
    const stats = await statfs(this.userDataRoot);
    return stats.bavail * stats.bsize;
  }

  quickState(id, ignoreOperation = false) {
    const manifest = assertComponentId(id);
    const root = this.rootFor(id);
    if (!ignoreOperation && this.operations.has(id)) return this.operations.get(id).snapshot;
    if (existsSync(this.corruptMarkerFor(id))) {
      return {
        id, name: manifest.name, version: manifest.version, optional: Boolean(manifest.optional), status: "corrupt",
        error: "Checksum thành phần không hợp lệ", downloadedBytes: 0,
        totalBytes: this.totalBytes(manifest),
      };
    }
    const expected = [...manifest.files, ...(manifest.archive ? [manifest.archive] : [])];
    const present = expected.filter((file) => {
      const target = safeJoin(root, file.relativePath);
      return existsSync(target) && statSync(target).size === file.size;
    }).length;
    let status = "missing";
    let error = null;
    if (present === expected.length) status = "ready";
    else if (present > 0) {
      status = "corrupt";
      error = "Thiếu file hoặc kích thước file không đúng";
    }
    return {
      id, name: manifest.name, version: manifest.version, optional: Boolean(manifest.optional), status, error,
      downloadedBytes: status === "ready" ? this.totalBytes(manifest) : 0,
      totalBytes: this.totalBytes(manifest),
    };
  }

  async getStatuses() {
    const freeBytes = await this.getFreeBytes();
    return { components: Object.keys(COMPONENT_MANIFESTS).map((id) => this.quickState(id)), freeBytes };
  }

  getQuickStatuses() {
    return Object.fromEntries(Object.keys(COMPONENT_MANIFESTS).map((id) => [id, this.quickState(id)]));
  }

  emit(id, changes) {
    const operation = this.operations.get(id);
    if (!operation) return;
    Object.assign(operation.snapshot, changes);
    this.onProgress({ ...operation.snapshot });
  }

  async verify(id) {
    const manifest = assertComponentId(id);
    const root = this.rootFor(id);
    const standalone = !this.operations.has(id);
    if (standalone) {
      this.operations.set(id, { controller: new AbortController(), snapshot: { ...this.quickState(id), status: "verifying", error: null } });
    }
    const signal = this.operations.get(id).controller.signal;
    this.emit(id, { status: "verifying", error: null });
    try {
      for (const file of [...manifest.files, ...(manifest.archive ? [manifest.archive] : [])]) {
        signal.throwIfAborted();
        const target = safeJoin(root, file.relativePath);
        if (!existsSync(target) || statSync(target).size !== file.size || await sha256File(target, signal) !== file.sha256) {
          throw new Error(`File không hợp lệ: ${file.relativePath}`);
        }
      }
      signal.throwIfAborted();
      writeFileSync(this.markerFor(id), JSON.stringify({ id, version: manifest.version, verifiedAt: new Date().toISOString() }, null, 2));
      rmSync(this.corruptMarkerFor(id), { force: true });
      this.emit(id, { status: "ready", downloadedBytes: this.totalBytes(manifest) });
      return this.quickState(id);
    } catch (error) {
      // Cancelling a check is not evidence that a model is corrupt. Preserve files/markers.
      if (signal.aborted) {
        this.emit(id, { ...this.quickState(id, true), error: "Đã hủy kiểm tra" });
        if (standalone) return this.quickState(id);
        throw error;
      }
      mkdirSync(root, { recursive: true });
      writeFileSync(this.corruptMarkerFor(id), "corrupt\n");
      this.emit(id, { status: existsSync(root) ? "corrupt" : "missing", error: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      if (standalone) this.operations.delete(id);
    }
  }

  async importLegacyDocling() {
    const target = this.rootFor("docling");
    if (this.quickState("docling").status === "ready") return true;
    for (const source of this.legacyDoclingRoots) {
      if (!existsSync(source) || path.resolve(source) === target) continue;
      try {
        if (await this.getFreeBytes() < this.totalBytes(COMPONENT_MANIFESTS.docling) + 128 * 1024 * 1024) continue;
        mkdirSync(target, { recursive: true });
        copyTree(source, target);
        await this.verify("docling");
        return true;
      } catch {
        // A legacy runtime from another version is left untouched and can be downloaded again.
      }
    }
    return false;
  }

  async verifyAdoptedComponents() {
    for (const id of Object.keys(COMPONENT_MANIFESTS)) {
      if (this.quickState(id).status === "ready" && !existsSync(this.markerFor(id))) {
        void this.verify(id).catch(() => undefined);
      }
    }
  }

  async install(id) {
    const manifest = assertComponentId(id);
    if (this.operations.has(id)) throw new Error("Thành phần đang được xử lý");
    const required = Math.max(0, this.totalBytes(manifest) - this.quickState(id).downloadedBytes) + 256 * 1024 * 1024;
    if (await this.getFreeBytes() < required) throw new Error("Không đủ dung lượng trống để tải thành phần");
    const operation = {
      controller: new AbortController(),
      snapshot: { ...this.quickState(id), status: "downloading", error: null, downloadedBytes: 0 },
    };
    this.operations.set(id, operation);
    this.emit(id, {});
    try {
      const root = this.rootFor(id);
      mkdirSync(root, { recursive: true });
      let completedBytes = 0;
      for (const file of manifest.files) {
        await this.downloadFile(file.url, safeJoin(root, file.relativePath), file, operation.controller.signal, (current) => {
          this.emit(id, { downloadedBytes: completedBytes + current });
        });
        completedBytes += file.size;
      }
      if (manifest.archive) {
        const archivePath = safeJoin(root, ".pdfium-win-x64.tgz");
        await this.downloadFile(manifest.archive.url, archivePath, null, operation.controller.signal, (current) => {
          this.emit(id, { downloadedBytes: completedBytes + Math.min(current, manifest.archive.size) });
        });
        await this.extractPdfium(archivePath, root, operation.controller.signal);
        rmSync(archivePath, { force: true });
      }
      await this.verify(id);
      if (id === "bge-m3" || id === "whisper-small") await this.onModelChanged(id);
      return this.quickState(id);
    } catch (error) {
      const cancelled = operation.controller.signal.aborted;
      this.emit(id, { ...(cancelled ? this.quickState(id, true) : { status: "error" }), error: cancelled ? "Đã hủy tải" : error instanceof Error ? error.message : String(error) });
      if (cancelled) return this.quickState(id);
      throw error;
    } finally {
      this.operations.delete(id);
    }
  }

  cancel(id) {
    assertComponentId(id);
    const operation = this.operations.get(id);
    if (operation) operation.controller.abort();
    return Boolean(operation);
  }

  async remove(id) {
    assertComponentId(id);
    if (this.operations.has(id)) throw new Error("Thành phần đang được xử lý");
    if (!await this.canRemove()) throw new Error("Không thể xóa khi tài liệu đang được xử lý");
    const root = this.rootFor(id);
    rmSync(root, { recursive: true, force: true });
    if (id === "bge-m3" || id === "whisper-small") await this.onModelChanged(id);
    return this.quickState(id);
  }

  async downloadFile(url, destination, expected, signal, progress) {
    signal.throwIfAborted();
    mkdirSync(path.dirname(destination), { recursive: true });
    if (
      expected
      && existsSync(destination)
      && statSync(destination).size === expected.size
      && await sha256File(destination, signal) === expected.sha256
    ) {
      progress(expected.size);
      return;
    }
    const partial = `${destination}.partial`;
    let offset = existsSync(partial) ? statSync(partial).size : 0;
    const response = await this.openDownload(url, offset, signal);
    if (offset > 0 && response.statusCode !== 206) {
      response.destroy();
      rmSync(partial, { force: true });
      offset = 0;
      return this.downloadFile(url, destination, expected, signal, progress);
    }
    if (![200, 206].includes(response.statusCode)) {
      const assetName = new URL(url).pathname.split("/").pop() || "thành phần";
      throw new Error(`Máy chủ tải xuống trả về HTTP ${response.statusCode} khi tải ${assetName}`);
    }
    await new Promise((resolve, reject) => {
      const output = createWriteStream(partial, { flags: offset ? "a" : "w" });
      let downloaded = offset;
      response.on("data", (chunk) => { downloaded += chunk.length; progress(downloaded); });
      response.once("error", reject);
      output.once("error", reject);
      output.once("finish", resolve);
      response.pipe(output);
      signal.addEventListener("abort", () => {
        response.destroy(new Error("Đã hủy tải"));
        output.destroy();
        reject(new Error("Đã hủy tải"));
      }, { once: true });
    });
    if (expected) {
      if (statSync(partial).size !== expected.size) throw new Error(`Kích thước tải xuống không đúng: ${expected.relativePath}`);
      if (await sha256File(partial, signal) !== expected.sha256) throw new Error(`Checksum không đúng: ${expected.relativePath}`);
    }
    signal.throwIfAborted();
    renameSync(partial, destination);
  }

  openDownload(url, offset, signal, redirects = 0) {
    if (redirects > 8) return Promise.reject(new Error("Quá nhiều chuyển hướng tải xuống"));
    return new Promise((resolve, reject) => {
      const client = url.startsWith("https:") ? https : http;
      const request = client.get(url, { headers: offset ? { Range: `bytes=${offset}-` } : {} }, (response) => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
          response.resume();
          resolve(this.openDownload(new URL(response.headers.location, url).toString(), offset, signal, redirects + 1));
          return;
        }
        resolve(response);
      });
      request.once("error", reject);
      signal.addEventListener("abort", () => request.destroy(new Error("Đã hủy tải")), { once: true });
    });
  }

  async extractPdfium(archivePath, root, signal) {
    const temporary = safeJoin(root, ".pdfium-extract");
    rmSync(temporary, { recursive: true, force: true });
    mkdirSync(temporary, { recursive: true });
    await new Promise((resolve, reject) => {
      const child = spawn("tar.exe", ["-xzf", archivePath, "-C", temporary, "bin/pdfium.dll"], { windowsHide: true });
      child.once("error", reject);
      child.once("exit", (code) => code === 0 ? resolve() : reject(new Error("Không thể giải nén PDFium")));
      signal.addEventListener("abort", () => child.kill(), { once: true });
    });
    const source = safeJoin(temporary, "bin/pdfium.dll");
    const destination = safeJoin(root, "pdfium/lib/pdfium.dll");
    mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(source, destination);
    rmSync(temporary, { recursive: true, force: true });
  }
}

module.exports = { BGE_REVISION, COMPONENT_MANIFESTS, ComponentManager, safeJoin, sha256File };
