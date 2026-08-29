// Experimental cache only. Never installs a component or changes the app model.
import { mkdir, readFile, rename, stat, statfs, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const model = "huuquyet/PhoWhisper-small";
const revision = "515c6b55639f2944aa8b64f2b0268b41c944353c";
const target = path.join(root, ".tmp/phowhisper-eval", model);
const names = ["config.json", "generation_config.json", "preprocessor_config.json", "tokenizer.json", "tokenizer_config.json", "onnx/encoder_model_quantized.onnx", "onnx/decoder_model_merged_quantized.onnx"];
const response = await fetch(`https://huggingface.co/api/models/${model}/revision/${revision}?blobs=true`, { signal: AbortSignal.timeout(30_000) });
if (!response.ok) throw new Error(`Metadata HTTP ${response.status}`);
const metadata = await response.json();
if (metadata.sha !== revision) throw new Error("Revision mismatch");
const files = names.map(name => {
  const file = metadata.siblings.find(item => item.rfilename === name);
  if (!file?.size || (!file.lfs?.sha256 && !file.blobId)) throw new Error(`Missing integrity metadata: ${name}`);
  return file;
});
await mkdir(target, { recursive: true });
const disk = await statfs(target);
const total = files.reduce((sum, file) => sum + file.size, 0);
if (disk.bavail * disk.bsize < total * 2) throw new Error("Insufficient free space for experiment");
async function valid(filename, file) {
  try {
    if ((await stat(filename)).size !== file.size) return false;
    const bytes = await readFile(filename);
    return file.lfs ? createHash("sha256").update(bytes).digest("hex") === file.lfs.sha256
      : createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex") === file.blobId;
  } catch { return false; }
}
for (const file of files) {
  const filename = path.join(target, file.rfilename);
  if (await valid(filename, file)) { console.log(`Verified cached ${file.rfilename}`); continue; }
  await mkdir(path.dirname(filename), { recursive: true });
  console.log(`Downloading ${file.rfilename} (${file.size} bytes)`);
  const download = await fetch(`https://huggingface.co/${model}/resolve/${revision}/${file.rfilename}`, { signal: AbortSignal.timeout(300_000) });
  if (!download.ok) throw new Error(`Download HTTP ${download.status}`);
  await pipeline(Readable.fromWeb(download.body), createWriteStream(`${filename}.partial`));
  if (!await valid(`${filename}.partial`, file)) throw new Error(`Checksum mismatch: ${file.rfilename}`);
  await rename(`${filename}.partial`, filename);
}
await writeFile(path.join(target, "eval-revision.json"), JSON.stringify({ model, revision, totalBytes: total, files, upstream: "vinai/PhoWhisper-small", upstreamRevision: "a86b604c346caf7148c37512eafe783a16420adb", note: "Community ONNX conversion; upstream PyTorch LFS SHA matches official repository. ONNX equivalence not independently proven." }, null, 2));
console.log(`Ready for isolated evaluation: ${target}`);
