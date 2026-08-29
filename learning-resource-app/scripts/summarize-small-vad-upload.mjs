// Preserve actual integration outputs in the permanent fixture suite; never touch app data.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.env.QA_AUDIO_ROOT || ".tmp/audio-small-vad-integration-20260829");
assert.ok(root.startsWith(path.resolve(".tmp") + path.sep));
const destination = path.resolve("test-fixtures/scholarflow/06_mindmap_audio/11_audio_quality");
const rows = JSON.parse(await readFile(path.join(root, "results.json"), "utf8"));
const searches = JSON.parse(await readFile(path.join(root, "search-results.json"), "utf8"));
const expected = JSON.parse(await readFile(path.join(destination, "expected.json"), "utf8"));
assert.equal(rows.length, 26);
assert.equal(searches.length, 3);
const words = text => text.normalize("NFC").toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
function errors(reference, actual) {
  let previous = Array.from({ length: actual.length + 1 }, (_, i) => i);
  for (let i = 0; i < reference.length; i++) {
    const current = [i + 1];
    for (let j = 0; j < actual.length; j++) current.push(Math.min(
      current[j] + 1, previous[j + 1] + 1, previous[j] + Number(reference[i] !== actual[j]),
    ));
    previous = current;
  }
  return previous[actual.length];
}
const quality = ["lecture-vi.mp3", "lecture-vi.wav", "lecture-vi.m4a", "lecture-en.mp3"].map(name => {
  const reference = words(expected.find(item => item.name === (name.includes("-en") ? "long-en" : "long-vi")).expected);
  const actual = words(rows.find(row => row.name === name).document.textContent);
  return { name, referenceUnits: reference.length, actualUnits: actual.length, edits: errors(reference, actual) };
});
const summary = {
  date: "2026-08-29", runtime: "Whisper Small Q8 + Silero VAD; real BGE-M3; isolated SQLite library",
  total: rows.length, ready: rows.filter(row => row.document?.status === "READY").length,
  failedSafely: rows.filter(row => row.document?.status === "FAILED").length,
  rejectedAtUpload: rows.filter(row => row.http !== 202).length,
  retrievalChecks: searches.length, quality,
  caveat: "Synthetic speech/noise fixtures, not representative of all real speakers. Functional pass does not mean perfect transcripts. Vietnamese counts are whitespace-separated syllabic units, English counts are words. Punctuation/case are ignored.",
};
for (const [name, data] of [["small-vad-upload-results.json", rows], ["small-vad-upload-searches.json", searches], ["small-vad-upload-summary.json", summary]]) {
  await writeFile(path.join(destination, name), JSON.stringify(data, null, 2) + "\n");
}
console.log(JSON.stringify(summary, null, 2));
