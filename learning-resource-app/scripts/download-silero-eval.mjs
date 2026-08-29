// Isolated experiment only. No component manager, app cache or executable changes.
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const revision = "867c2aa692646a1f1de3e94a15c9dd9f614c0acb";
const blob = "80c5592ef1f4c9ede3e357bbd02eb863358a6a9d";
const size = 2327524;
const url = `https://raw.githubusercontent.com/snakers4/silero-vad/${revision}/src/silero_vad/data/silero_vad.onnx`;
const dir = path.join(root, ".tmp/phowhisper-eval/silero");
const filename = path.join(dir, "silero_vad.onnx");
function valid(data) { return data.length === size && createHash("sha1").update(`blob ${data.length}\0`).update(data).digest("hex") === blob; }
let bytes;
try { bytes = await readFile(filename); } catch { /* download below */ }
if (!bytes || !valid(bytes)) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Silero HTTP ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
  if (!valid(bytes)) throw new Error("Silero revision/blob integrity mismatch");
  await mkdir(dir, { recursive: true });
  await writeFile(`${filename}.partial`, bytes);
  await rename(`${filename}.partial`, filename);
}
const metadata = { repository: "snakers4/silero-vad", revision, url, gitBlobSha1: blob, size, sha256: createHash("sha256").update(bytes).digest("hex"), license: "MIT" };
await writeFile(path.join(dir, "eval-revision.json"), JSON.stringify(metadata, null, 2));
console.log(JSON.stringify(metadata));
