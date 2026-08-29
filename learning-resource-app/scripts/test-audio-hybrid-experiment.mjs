import assert from "node:assert/strict";
import { speechIntervals, transcribeHybrid, RATE } from "./audio-hybrid-experiment.mjs";
assert.deepEqual(speechIntervals(Array(20).fill(0.1), 20 * 512), []);
assert.deepEqual(speechIntervals(Array(5).fill(0.9), 5 * 512), []); // transient <250 ms
assert.deepEqual(speechIntervals([...Array(10).fill(0.9), ...Array(6).fill(0.1)], 16 * 512), [{ start: 0, end: 5120 }]);
assert.throws(() => speechIntervals([NaN], 512), /Invalid VAD/);
function mocks({ languages = [50278, 50259], noSpeech = false, truncated = false, secondFailure = false } = {}) {
  const calls = [];
  const generation_config = { decoder_start_token_id: 50258, eos_token_id: 50257, lang_to_id: { "<|vi|>": 50278, "<|en|>": 50259 } };
  let detections = 0;
  const small = { processor: async () => ({ input_features: "same-features" }), tokenizer: { decode: () => "English words" }, model: { generation_config, generate: async options => {
    calls.push({ model: "small", language: options.language ?? "detect" });
    if (options.max_new_tokens === 1) return { tolist: () => [[50258, languages[detections++]]] };
    if (secondFailure) throw new Error("second window failed");
    return { tolist: () => [[1, 50257]] };
  } } };
  const pho = { tokenizer: { decode: () => "Nội dung tiếng Việt" }, model: { generation_config, generate: async options => {
    calls.push({ model: "pho", language: options.language });
    assert.equal(options.inputs, "same-features");
    return { tolist: () => [[1, truncated ? 99 : 50257]] };
  } } };
  const vad = { detect: async samples => ({ intervals: noSpeech ? [] : [{ start: 0, end: samples.length }], speechSeconds: noSpeech ? 0 : samples.length / RATE }) };
  return { small, pho, vad, calls };
}
const audio = new Float32Array(RATE * 32).fill(0.05);
const models = mocks();
const result = await transcribeHybrid(audio, models);
assert.equal(result.language, "mixed");
assert.deepEqual(models.calls, [{ model: "small", language: "detect" }, { model: "pho", language: "vi" }, { model: "small", language: "detect" }, { model: "small", language: "en" }]);
assert.equal(result.text, "Nội dung tiếng Việt English words");
const blocked = mocks({ noSpeech: true });
await assert.rejects(transcribeHybrid(audio, blocked), error => error.code === "NO_SPEECH");
assert.equal(blocked.calls.length, 0);
await assert.rejects(transcribeHybrid(audio, mocks({ languages: [50260] })), error => error.code === "LANGUAGE");
await assert.rejects(transcribeHybrid(audio, mocks({ truncated: true })), error => error.code === "TRUNCATED");
await assert.rejects(transcribeHybrid(audio, mocks({ secondFailure: true })), /second window failed/);
await assert.rejects(transcribeHybrid(audio, mocks(), { cancelled: () => true }), error => error.code === "CANCELLED");
let clock = 0;
await assert.rejects(transcribeHybrid(audio, mocks(), { now: () => clock += 1_000_000 }), error => error.code === "TIMEOUT");
const skip = mocks();
skip.vad.detect = async () => ({ intervals: [{ start: 0, end: RATE }], speechSeconds: 1 });
const skipped = await transcribeHybrid(audio, skip);
assert.equal(skipped.routes[1].skipped, "no-speech");
assert.ok(skipped.routes[1].end <= 32);
assert.equal(skip.calls.length, 2);
const smallOnly = mocks();
smallOnly.pho = null;
const safe = await transcribeHybrid(audio, smallOnly);
assert.ok(smallOnly.calls.every(call => call.model === "small"));
assert.ok(safe.routes.every(route => route.model === "Small"));
console.log("PASS experimental hybrid: VAD thresholds, no-speech before ASR, independent language routing, timestamps, skipped windows, cancellation/deadline, truncated/later failure without partial success.");
