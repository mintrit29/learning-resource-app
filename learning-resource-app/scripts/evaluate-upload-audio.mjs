// Read-only model evaluation: no downloads, library/database writes or microphone use.
// AUDIO_EVAL_CACHE=<local model cache> node scripts/evaluate-upload-audio.mjs [fixture names]
// AUDIO_EVAL_MODEL=base compares with the previous model; Small is the app default.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import { transcribeUploadedSamples } from "../embedding-runtime/upload-transcription.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = path.join(root, "test-fixtures/scholarflow/06_mindmap_audio/11_audio_quality");
if (!process.env.AUDIO_EVAL_CACHE) throw new Error("Set AUDIO_EVAL_CACHE to an existing Whisper cache; this evaluator never downloads models.");
const variant = process.env.AUDIO_EVAL_MODEL || "small";
if (!["base", "small", "phowhisper"].includes(variant)) throw new Error("AUDIO_EVAL_MODEL must be base, small or phowhisper (experimental only)");
const require = createRequire(path.join(root, "embedding-runtime/package.json"));
const { env, pipeline } = await import(pathToFileURL(require.resolve("@huggingface/transformers")).href);
env.cacheDir = path.resolve(process.env.AUDIO_EVAL_CACHE);
env.allowRemoteModels = false;
env.allowLocalModels = true;
const model = variant === "phowhisper" ? "huuquyet/PhoWhisper-small" : `onnx-community/whisper-${variant}`;
const loadStart = performance.now();
const asr = await pipeline("automatic-speech-recognition", model, { device: "cpu", dtype: "q8" });
const loadMs = performance.now() - loadStart;
const expected = JSON.parse(await readFile(path.join(fixtures, "expected.json"), "utf8"));
const names = process.argv.slice(2);
if (!names.length) names.push("short-vi.mp3", "short-vi.wav", "short-vi.m4a", "lecture-vi.mp3", "lecture-vi.wav", "lecture-vi.m4a", "lecture-en.mp3", "mixed.m4a", "baseline-vi.mp3", "baseline-en.wav", "silence.wav", "silence.m4a", "noise.wav", "database.mp3", "female-1.mp3", "female-2.mp3", "male-1.mp3", "male-2.mp3", "en-female-1.mp3", "en-female-2.mp3", "en-male-1.mp3", "en-male-2.mp3");
const words = value => value.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").trim().split(/\s+/u).filter(Boolean);
function distance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++) next.push(Math.min(next[j] + 1, previous[j + 1] + 1, previous[j] + (a[i] === b[j] ? 0 : 1)));
    previous = next;
  }
  return previous[b.length];
}
const rows = [];
const extraReferences = {
  "female-1.mp3": "Tìm tài liệu về mạng máy tính", "male-1.mp3": "Tìm tài liệu về mạng máy tính",
  "female-2.mp3": "Tìm tài liệu về cơ sở dữ liệu", "male-2.mp3": "Tìm tài liệu về cơ sở dữ liệu",
  "en-female-1.mp3": "computer science", "en-male-1.mp3": "computer science",
  "en-female-2.mp3": "database", "en-male-2.mp3": "database",
  "database.mp3": "database",
};
try {
  for (const name of names) {
    if (path.basename(name) !== name || !/\.(mp3|wav|m4a)$/.test(name)) throw new Error("Use an audio filename from the fixed test fixture directory");
    const result = spawnSync(require("ffmpeg-static"), ["-v", "error", "-i", path.join(fixtures, name), "-f", "f32le", "-ac", "1", "-ar", "16000", "pipe:1"], { windowsHide: true, timeout: 60_000, maxBuffer: 32 * 1024 * 1024 });
    if (result.status !== 0) throw new Error(`Fixture decoding failed: ${name}`);
    const pcm = result.stdout;
    let output;
    try { output = await transcribeUploadedSamples(new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4).slice(), asr); }
    catch (error) { output = { error: error.message }; }
    const reference = name.startsWith("short-vi") ? "Tìm tài liệu về cơ sở dữ liệu"
      : name.startsWith("lecture-vi") ? expected[0].expected
      : name === "lecture-en.mp3" ? expected[1].expected
      : name === "mixed.m4a" ? expected.map(item => item.expected).join(" ") : extraReferences[name] ?? null;
    const row = { name, model, loadMs, peakRssMiB: process.resourceUsage().maxRSS / 1024, fixtureSha256: (await import("node:crypto")).createHash("sha256").update(await readFile(path.join(fixtures, name))).digest("hex"), ...output };
    if (reference && output.text) Object.assign(row, { referenceWords: words(reference).length, wordEdits: distance(words(reference), words(output.text)) });
    rows.push(row);
    console.log(JSON.stringify(row));
    await mkdir(path.join(root, ".tmp"), { recursive: true });
    await writeFile(path.join(root, `.tmp/audio-evaluation-${variant}.json`), JSON.stringify(rows, null, 2));
  }
} finally { await asr.dispose(); }
