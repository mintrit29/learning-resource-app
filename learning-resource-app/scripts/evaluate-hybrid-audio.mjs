// Isolated candidate evaluation. No app database or model configuration writes.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { createSpeechDetector, transcribeHybrid } from "./audio-hybrid-experiment.mjs";
import { transcribeUploadedSamples } from "../embedding-runtime/upload-transcription.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "embedding-runtime/package.json"));
const fixtures = path.join(root, "test-fixtures/scholarflow/06_mindmap_audio/11_audio_quality");
const previous = JSON.parse(await readFile(path.join(fixtures, "phowhisper-comparison.json"), "utf8"));
const additional = JSON.parse(await readFile(path.join(fixtures, "hybrid/expected.json"), "utf8"));
const references = JSON.parse(await readFile(path.join(fixtures, "expected.json"), "utf8"));
const reference = name => name.startsWith("short-vi") || /^(fe)?male-2/.test(name) ? "Tìm tài liệu về cơ sở dữ liệu"
  : /^(fe)?male-1/.test(name) ? "Tìm tài liệu về mạng máy tính"
  : name.startsWith("lecture-vi") ? references[0].expected
  : name === "lecture-en.mp3" ? references[1].expected
  : name === "mixed.m4a" ? references.map(item => item.expected).join(" ")
  : name === "database.mp3" || /^en-.+-2/.test(name) ? "database"
  : /^en-.+-1/.test(name) ? "computer science" : null;
const cases = [...previous.baseline.map(item => ({ name: item.name, reference: reference(item.name), sha256: item.fixtureSha256, type: /^(silence|noise)/.test(item.name) ? "non-speech" : "speech" })), ...additional.cases];
const requested = process.argv.slice(2);
if (requested.some(name => !cases.some(item => item.name === name))) throw new Error("Use only known fixed fixture names");
const selected = requested.length ? cases.filter(item => requested.includes(item.name)) : cases;
const mode = process.env.HYBRID_EVAL_MODE ?? "hybrid";
if (!["hybrid", "small", "small-vad", "vad"].includes(mode)) throw new Error("Unknown evaluation mode");
const { env, pipeline } = await import(pathToFileURL(require.resolve("@huggingface/transformers")).href);
const ort = require("onnxruntime-node");
env.allowRemoteModels = false; env.allowLocalModels = true;
const cache = path.join(root, ".tmp/phowhisper-eval");
const smallCache = process.env.AUDIO_EVAL_CACHE ?? path.join(process.env.APPDATA, "ScholarFlow/models");
const provenance = JSON.parse(await readFile(path.join(cache, "silero/eval-revision.json"), "utf8"));
const vadFilename = path.join(cache, "silero/silero_vad.onnx");
assert.equal(createHash("sha256").update(await readFile(vadFilename)).digest("hex"), provenance.sha256);
let vad, small, pho;
const loadStart = performance.now();
const rows = [];
const units = text => text.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").trim().split(/\s+/u).filter(Boolean);
function edits(a, b) { let p = Array.from({ length: b.length + 1 }, (_, i) => i); for (let i = 0; i < a.length; i++) { const n = [i + 1]; for (let j = 0; j < b.length; j++) n.push(Math.min(n[j] + 1, p[j + 1] + 1, p[j] + Number(a[i] !== b[j]))); p = n; } return p[b.length]; }
try {
  if (mode !== "small") vad = await createSpeechDetector(ort, vadFilename);
  if (mode !== "vad") { env.cacheDir = smallCache; small = await pipeline("automatic-speech-recognition", "onnx-community/whisper-small", { device: "cpu", dtype: "q8" }); }
  if (mode === "hybrid") {
    assert.deepEqual(JSON.parse(await readFile(path.join(smallCache, "onnx-community/whisper-small/preprocessor_config.json"))), JSON.parse(await readFile(path.join(cache, "huuquyet/PhoWhisper-small/preprocessor_config.json"))), "Shared input features require matching preprocessors");
    env.cacheDir = cache; pho = await pipeline("automatic-speech-recognition", "huuquyet/PhoWhisper-small", { device: "cpu", dtype: "q8" });
  }
  const loadMs = performance.now() - loadStart;
  for (const item of selected) {
    const filename = path.join(fixtures, item.name);
    const sha256 = createHash("sha256").update(await readFile(filename)).digest("hex");
    if (item.sha256) assert.equal(sha256, item.sha256, `Changed baseline fixture ${item.name}`);
    const started = performance.now();
    let result;
    try {
      const decoded = spawnSync(require("ffmpeg-static"), ["-v", "error", "-i", filename, "-f", "f32le", "-ac", "1", "-ar", "16000", "pipe:1"], { windowsHide: true, timeout: 60_000, maxBuffer: 32 * 1024 * 1024 });
      if (decoded.status !== 0) throw Object.assign(new Error("Decode failed"), { code: "DECODE" });
      const samples = new Float32Array(decoded.stdout.buffer, decoded.stdout.byteOffset, decoded.stdout.length / 4).slice();
      result = mode === "vad" ? await vad.detect(samples) : mode === "small" ? await transcribeUploadedSamples(samples, small) : await transcribeHybrid(samples, { small, pho, vad });
    } catch (error) { result = { error: error.message, code: error.code ?? null }; }
    const row = { name: item.name, type: item.type, reference: item.reference, sha256, mode, ...result, totalMs: Math.round(performance.now() - started), peakRssMiB: process.resourceUsage().maxRSS / 1024 };
    if (result.text && item.reference) Object.assign(row, { referenceUnits: units(item.reference).length, edits: edits(units(item.reference), units(result.text)) });
    if (mode === "vad") row.expectedGatePass = item.type === "non-speech" ? result.intervals?.length === 0 : result.intervals?.length > 0;
    else if (item.type === "non-speech") row.expectedGatePass = Boolean(result.error) && !result.text;
    rows.push(row);
    await writeFile(path.join(fixtures, `hybrid-${mode}-results.json`), JSON.stringify({ mode, scope: "ASR experiment only, no integration", silero: provenance, loadMs, runtime: { cpu: os.cpus()[0].model, node: process.version, transformers: "4.2.0", onnxruntime: "1.24.3" }, rows }, null, 2));
    console.log(JSON.stringify({ name: row.name, edits: row.edits, code: row.code, gate: row.expectedGatePass, speechSeconds: result.speechSeconds, text: result.text, totalMs: row.totalMs }));
  }
} finally { if (vad) await vad.dispose(); if (pho) await pho.dispose(); if (small) await small.dispose(); }
