import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { verifySpeechModel } from "../embedding-runtime/speech-detector.mjs";
import { hasSpeechEnergy, hasRepetitiveTranscript, splitUploadAudio, transcribeUploadedSamples } from "../embedding-runtime/upload-transcription.mjs";

assert.equal(hasSpeechEnergy(new Float32Array(16000)), false);
assert.equal(hasSpeechEnergy(new Float32Array([NaN])), false);
assert.equal(hasSpeechEnergy(new Float32Array(16000).fill(.1)), true);
assert.equal(hasRepetitiveTranscript("tập trung ".repeat(30)), true);
assert.equal(hasRepetitiveTranscript("thích ".repeat(25)), true);
assert.equal(hasRepetitiveTranscript("Cơ sở dữ liệu lưu trữ dữ liệu. Các bảng liên kết dữ liệu bằng khóa ngoại."), false);
assert.equal(hasRepetitiveTranscript("rất rất tốt"), false);
const samples = new Float32Array(65 * 16000).fill(.05);
samples.fill(0, 25 * 16000, 26 * 16000);
const windows = splitUploadAudio(samples);
assert.equal(windows[0].start, 0);
assert.ok(windows[0].end >= 25 * 16000 && windows[0].end <= 26 * 16000);
assert.equal(windows.at(-1).end, samples.length);
for (let i = 0; i < windows.length; i++) {
  assert.ok(windows[i].end > windows[i].start);
  assert.ok(windows[i].end - windows[i].start <= 30 * 16000);
  if (i) assert.equal(windows[i].start, windows[i - 1].end);
}

function fakeTranscriber({ languages = [1], text = "Tài liệu về mạng máy tính.", endToken = 9, onGenerate = () => {} } = {}) {
  const calls = [];
  let segment = -1;
  return {
    calls,
    processor: async (audio) => ({ input_features: audio }),
    model: {
      generation_config: { decoder_start_token_id: 0, eos_token_id: 9, lang_to_id: { "<|vi|>": 1, "<|en|>": 2, "<|fr|>": 3 } },
      generate: async (options) => {
        calls.push(options); onGenerate();
        options.stopping_criteria[0]([[0]]);
        if (options.max_new_tokens === 1) {
          segment++;
          return { tolist: () => [[0, languages[segment % languages.length]]] };
        }
        assert.equal(options.return_timestamps, false);
        assert.equal(options.task, "transcribe");
        assert.ok(options.max_new_tokens <= 384);
        return { tolist: () => [[0, 1, 4, 5, 6, endToken]] };
      },
    },
    tokenizer: { decode: () => text },
  };
}
const fake = fakeTranscriber({ languages: [1, 2] });
const output = await transcribeUploadedSamples(samples, fake);
assert.equal(output.language, "mixed");
assert.equal(output.timestamp_precision, "segment");
assert.equal(output.chunks.length, windows.length);
assert.equal(output.chunks[0].start, 0);
assert.equal(output.chunks.at(-1).end, 65);
assert.equal(output.text, output.chunks.map(c => c.text).join(" "));
await assert.rejects(transcribeUploadedSamples(new Float32Array(16000), fake), /Không nghe thấy/);
await assert.rejects(transcribeUploadedSamples(samples, fake, { cancelled: () => true }), /Đã dừng/);
await assert.rejects(transcribeUploadedSamples(samples, fakeTranscriber({ languages: [3] })), /tiếng Việt hoặc tiếng Anh/);
await assert.rejects(transcribeUploadedSamples(samples, fakeTranscriber({ endToken: 6 })), /bị ngắt hoặc lặp/);
await assert.rejects(transcribeUploadedSamples(samples, fakeTranscriber({ text: "thích ".repeat(30) })), /lặp bất thường/);
let clock = 0;
await assert.rejects(transcribeUploadedSamples(samples, fakeTranscriber({ onGenerate: () => { clock += 4_000_000; } }), { now: () => clock }), /quá nhiều thời gian/);
// Failure in a later segment must reject the entire result, never save the prefix as complete.
await assert.rejects(transcribeUploadedSamples(samples, fakeTranscriber({ languages: [1, 3] })), /tiếng Việt hoặc tiếng Anh/);

// Production VAD gate: no hallucinated noise, original timestamps, failure/cancel propagation.
const noiseModel = fakeTranscriber();
await assert.rejects(transcribeUploadedSamples(samples, noiseModel, {
  vad: { detect: async () => ({ intervals: [] }) },
}), /Không phát hiện lời nói/);
assert.equal(noiseModel.calls.length, 0);
const accepted = await transcribeUploadedSamples(samples, fakeTranscriber(), {
  vad: { detect: async () => ({ intervals: [{ start: 0, end: 16000 }] }) },
});
assert.equal(accepted.chunks.length, 1);
assert.equal(accepted.chunks[0].end, windows[0].end / 16000);
await assert.rejects(transcribeUploadedSamples(samples, fakeTranscriber(), {
  vad: { detect: async () => { throw new Error("VAD failed"); } },
}), /VAD failed/);
let aborted = false;
await assert.rejects(transcribeUploadedSamples(samples, fakeTranscriber(), {
  cancelled: () => aborted,
  vad: { detect: async () => { aborted = true; return { intervals: [{ start: 0, end: 16000 }] }; } },
}), /Đã dừng/);
const service = await readFile(new URL("../embedding-runtime/service.mjs", import.meta.url), "utf8");
const vadTestRoot = await mkdtemp(path.join(tmpdir(), "scholarflow-vad-validation-"));
try {
  const candidate = path.join(vadTestRoot, "silero.onnx");
  await assert.rejects(verifySpeechModel(candidate), error => error.statusCode === 503 && /Thiếu Silero/.test(error.message));
  await writeFile(candidate, "corrupt model");
  await assert.rejects(verifySpeechModel(candidate), error => error.statusCode === 503 && /bị hỏng/.test(error.message));
} finally {
  assert.equal(path.dirname(vadTestRoot), path.resolve(tmpdir()));
  assert.ok(path.basename(vadTestRoot).startsWith("scholarflow-vad-validation-"));
  await rm(vadTestRoot, { recursive: true, force: true });
}
assert.match(service, /transcribeUploadedSamples\(samples, transcriber, \{ cancelled, vad \}\)/);
const packaging = await readFile(new URL("../electron-builder.yml", import.meta.url), "utf8");
assert.match(packaging, /- "upload-transcription\.mjs"/, "Future installers must include the upload helper; no EXE is built by this test");
console.log("PASS upload-only transcription: contiguous windows, per-window language, silence, repetition, token limit, deadline, cancellation, no partial success; voice path removed");
