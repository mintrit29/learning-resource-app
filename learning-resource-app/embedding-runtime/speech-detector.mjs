// Silero VAD, MIT. Pinned upstream wrapper: snakers4/silero-vad @ 867c2aa.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
export const VAD_SHA256 = "1a153a22f4509e292a94e67d6f9b85e8deb25b4988682b7e174c65279d8788e3";
export async function verifySpeechModel(filename) {
  let bytes;
  try { bytes = await readFile(filename); } catch {
    throw Object.assign(new Error("Thiếu Silero VAD. Hãy mở Cài đặt → Thành phần cục bộ và tải lại Whisper Small + VAD."), { statusCode: 503 });
  }
  if (createHash("sha256").update(bytes).digest("hex") !== VAD_SHA256) {
    throw Object.assign(new Error("Silero VAD bị hỏng. Hãy tải lại Whisper Small + VAD trong Cài đặt → Thành phần cục bộ."), { statusCode: 503 });
  }
}
export const RATE = 16000;
const FRAME = 512;
function fail(message, code = "UNSUPPORTED_AUDIO") { return Object.assign(new Error(message), { code }); }

export function speechIntervals(probabilities, length) {
  const intervals = [];
  let start = null;
  let quietStart = null;
  const finish = end => {
    if (end - start >= RATE * 0.25) intervals.push({ start, end: Math.min(end, length) });
    start = null; quietStart = null;
  };
  for (let i = 0; i < probabilities.length; i++) {
    const position = i * FRAME;
    const probability = probabilities[i];
    if (!Number.isFinite(probability)) throw fail("Invalid VAD output", "VAD_OUTPUT");
    if (start === null) {
      if (probability >= 0.5) start = position;
      continue;
    }
    if (probability >= 0.35) quietStart = null;
    else if (quietStart === null) quietStart = position;
    else if (position - quietStart >= RATE * 0.1) finish(quietStart);
  }
  if (start !== null) finish(quietStart ?? length);
  return intervals;
}

export async function createSpeechDetector(ort, filename) {
  const session = await ort.InferenceSession.create(filename, { executionProviders: ["cpu"], intraOpNumThreads: 1, interOpNumThreads: 1 });
  if (!session.inputNames.includes("input") || !session.outputNames.includes("stateN")) {
    await session.release(); throw fail("Unexpected VAD graph", "VAD_GRAPH");
  }
  return {
    async detect(samples, check = () => {}) {
      let state = new Float32Array(2 * 128);
      let context = new Float32Array(64);
      const probabilities = [];
      for (let start = 0; start < samples.length; start += FRAME) {
        check();
        const input = new Float32Array(FRAME + 64);
        input.set(context);
        input.set(samples.subarray(start, Math.min(start + FRAME, samples.length)), 64);
        const tensors = { input: new ort.Tensor("float32", input, [1, FRAME + 64]), state: new ort.Tensor("float32", state, [2, 1, 128]), sr: new ort.Tensor("int64", BigInt64Array.of(16000n), []) };
        let output;
        try {
          output = await session.run(tensors);
          probabilities.push(Number(output.output.data[0]));
          state = Float32Array.from(output.stateN.data);
          context = input.slice(-64);
        } finally {
          for (const tensor of Object.values(tensors)) tensor.dispose();
          if (output) for (const tensor of Object.values(output)) tensor.dispose();
        }
      }
      const intervals = speechIntervals(probabilities, samples.length);
      return { intervals, maxProbability: probabilities.reduce((highest, value) => Math.max(highest, value), 0),
        speechSeconds: intervals.reduce((sum, item) => sum + item.end - item.start, 0) / RATE };
    },
    dispose: () => session.release(),
  };
}
