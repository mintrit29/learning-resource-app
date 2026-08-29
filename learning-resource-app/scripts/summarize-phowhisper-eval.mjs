// Preserve reproducible, raw A/B evidence; no app/database writes.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseline = JSON.parse(await readFile(path.join(root, ".tmp/audio-evaluation-small.json"), "utf8"));
const candidate = JSON.parse(await readFile(path.join(root, ".tmp/audio-evaluation-phowhisper.json"), "utf8"));
if (baseline.length !== 22 || candidate.length !== 22) throw new Error("Expected complete 22-case A/B runs");
const provenance = JSON.parse(await readFile(path.join(root, ".tmp/phowhisper-eval/huuquyet/PhoWhisper-small/eval-revision.json"), "utf8"));
const comparisons = baseline.map(previous => {
  const next = candidate.find(item => item.name === previous.name);
  if (!next || next.fixtureSha256 !== previous.fixtureSha256) throw new Error(`Mismatched fixture ${previous.name}`);
  return { name: previous.name, sha256: previous.fixtureSha256, referenceUnits: previous.referenceWords ?? null,
    smallEdits: previous.wordEdits ?? null, phoEdits: next.wordEdits ?? null,
    smallMs: previous.elapsed_ms ?? null, phoMs: next.elapsed_ms ?? null,
    smallError: previous.error ?? null, phoError: next.error ?? null };
});
const result = { date: new Date().toISOString(), scope: "Uploaded-audio ASR helper only; no UI, DB, embedding, microphone or app model change",
  corpus: "Synthetic TTS; includes same Vietnamese speech transcoded into 3 formats. Not 22 independent linguistic examples. Not human-voice evaluation.",
  metric: "Levenshtein edits on NFC/lowercased text with punctuation removed and whitespace splitting. Vietnamese units are mostly syllables, not linguistic words. No post-correction.",
  runtime: { node: process.version, platform: process.platform, arch: process.arch, cpu: os.cpus()[0].model, logicalCpus: os.cpus().length, ramGiB: os.totalmem() / 1024 ** 3, transformers: "4.2.0", onnxruntime: "1.24.3", device: "cpu", dtype: "q8", sequential: true },
  provenance, comparisons, baseline, candidate };
const output = path.join(root, "test-fixtures/scholarflow/06_mindmap_audio/11_audio_quality/phowhisper-comparison.json");
await writeFile(output, JSON.stringify(result, null, 2));
console.table(comparisons.map(({ name, referenceUnits, smallEdits, phoEdits, smallMs, phoMs, smallError, phoError }) => ({ name, referenceUnits, smallEdits, phoEdits, smallMs, phoMs, smallError, phoError })));
console.log(`Peak RSS MiB: Small=${Math.max(...baseline.map(item => item.peakRssMiB))}; Pho=${Math.max(...candidate.map(item => item.peakRssMiB))}`);
console.log(output);
