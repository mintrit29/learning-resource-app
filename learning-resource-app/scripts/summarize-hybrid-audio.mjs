import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = path.join(root, "test-fixtures/scholarflow/06_mindmap_audio/11_audio_quality");
const load = async name => JSON.parse(await readFile(path.join(fixtures, name), "utf8"));
const original = await load("phowhisper-comparison.json");
const additional = await load("hybrid-small-results.json");
const hybrid = await load("hybrid-hybrid-results.json");
const vad = await load("hybrid-vad-results.json");
const smallVad = await load("hybrid-small-vad-results.json");
assert.equal(hybrid.rows.length, 31, "Incomplete candidate run");
assert.equal(vad.rows.length, 31, "Incomplete VAD run");
assert.equal(smallVad.rows.length, 31, "Incomplete Small + VAD run");
assert.equal(additional.rows.length, 9, "Run Small on the nine new stress cases");
const previous = [...original.baseline.map(item => ({ ...item, sha256: item.fixtureSha256, edits: item.wordEdits })), ...additional.rows];
const normalized = text => text.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").trim().replace(/\s+/gu, " ");
const comparisons = hybrid.rows.map(row => {
  const small = previous.find(item => item.name === row.name);
  assert.ok(small, `Missing baseline ${row.name}`);
  assert.equal(small.sha256, row.sha256, `Different input ${row.name}`);
  const vadRow = vad.rows.find(item => item.name === row.name);
  assert.equal(vadRow.sha256, row.sha256, `Different VAD input ${row.name}`);
  const safeRow = smallVad.rows.find(item => item.name === row.name);
  assert.equal(safeRow.sha256, row.sha256, `Different Small + VAD input ${row.name}`);
  const noSpeechPass = row.type === "non-speech" ? row.code === "NO_SPEECH" && !row.text : null;
  return { name: row.name, type: row.type, referenceUnits: row.referenceUnits ?? null,
    smallEdits: small.edits ?? null, hybridEdits: row.edits ?? null, smallVadEdits: safeRow.edits ?? null,
    smallError: small.error ?? null, hybridError: row.error ?? null, smallVadError: safeRow.error ?? null,
    smallVadPreservedText: row.type !== "non-speech" && small.text ? Boolean(safeRow.text) && normalized(small.text) === normalized(safeRow.text) : null,
    noSpeechPass, smallVadNoSpeechPass: row.type === "non-speech" ? safeRow.code === "NO_SPEECH" && !safeRow.text : null,
    vadGatePass: vadRow.expectedGatePass, candidateMsIncludingDecode: row.totalMs, smallVadMsIncludingDecode: safeRow.totalMs };
});
const result = { date: new Date().toISOString(), scope: "Experimental ASR helper; not installed in app; original 22-case Small baseline reused after SHA verification; nine new Small cases rerun", comparisons,
  vadPasses: comparisons.filter(item => item.vadGatePass).length,
  nonSpeechPasses: comparisons.filter(item => item.noSpeechPass === true).length,
  positiveCasesWithRuntimeErrors: comparisons.filter(item => item.type !== "non-speech" && (item.hybridError || item.smallVadError)),
  smallVadTextRegressions: comparisons.filter(item => item.smallVadPreservedText === false),
  hybridPeakRssMiB: Math.max(...hybrid.rows.map(item => item.peakRssMiB)),
  smallVadPeakRssMiB: Math.max(...smallVad.rows.map(item => item.peakRssMiB)),
  limits: ["Synthetic TTS/signals only, no human recordings", "Long mixed file loses initial English sentence inside Vietnamese-dominant window; lower edit count does not mean full coverage", "VAD is a speech gate, not a guarantee against all hallucinations", "Timing includes FFmpeg and VAD; previous baseline elapsed_ms does not include decoding; do not compare as a controlled speed benchmark"],
  provenance: { silero: hybrid.silero, pho: original.provenance, runtime: hybrid.runtime },
  evidence: ["phowhisper-comparison.json", "hybrid-small-results.json", "hybrid-hybrid-results.json", "hybrid-small-vad-results.json", "hybrid-vad-results.json"] };
await writeFile(path.join(fixtures, "hybrid-comparison.json"), JSON.stringify(result, null, 2));
console.table(comparisons.map(({ name, smallEdits, hybridEdits, smallVadEdits, noSpeechPass, hybridError }) => ({ name, smallEdits, hybridEdits, smallVadEdits, noSpeechPass, hybridError })));
console.log(JSON.stringify({ vadPasses: result.vadPasses, nonSpeechPasses: result.nonSpeechPasses, positiveRuntimeErrors: result.positiveCasesWithRuntimeErrors, hybridPeakRssMiB: result.hybridPeakRssMiB, smallVadPeakRssMiB: result.smallVadPeakRssMiB }));
