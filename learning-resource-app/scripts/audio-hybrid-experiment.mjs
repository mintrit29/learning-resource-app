// Experimental only: not imported by any application module.
// Silero ONNX I/O follows the upstream wrapper at pinned commit 867c2aa.
// https://github.com/snakers4/silero-vad/blob/867c2aa692646a1f1de3e94a15c9dd9f614c0acb/src/silero_vad/utils_vad.py
import { hasSpeechEnergy, hasRepetitiveTranscript, splitUploadAudio } from "../embedding-runtime/upload-transcription.mjs";
export { speechIntervals, createSpeechDetector } from "../embedding-runtime/speech-detector.mjs";
export const RATE = 16000;
function fail(message, code = "UNSUPPORTED_AUDIO") { return Object.assign(new Error(message), { code }); }

export async function transcribeHybrid(samples, { small, pho, vad }, { cancelled = () => false, now = () => performance.now() } = {}) {
  if (!hasSpeechEnergy(samples)) throw fail("Không nghe thấy lời nói trong file âm thanh.", "NO_SPEECH");
  const started = now();
  const deadline = started + Math.min(55 * 60_000, Math.max(90_000, samples.length / RATE * 8000));
  const check = () => {
    if (cancelled()) throw fail("Đã dừng thử nghiệm.", "CANCELLED");
    if (now() >= deadline) throw fail("Thử nghiệm chép lời quá thời gian.", "TIMEOUT");
  };
  const activity = await vad.detect(samples, check);
  check();
  if (!activity.intervals.length) throw fail("Không phát hiện lời nói; không chép tiếng nhiễu.", "NO_SPEECH");
  const chunks = [];
  const routes = [];
  const config = small.model.generation_config;
  const languageIds = new Map(Object.entries(config.lang_to_id).map(([token, id]) => [id, token.slice(2, -2)]));
  for (const window of splitUploadAudio(samples)) {
    check();
    const speechSamples = activity.intervals.reduce((sum, span) => sum + Math.max(0, Math.min(span.end, window.end) - Math.max(span.start, window.start)), 0);
    if (speechSamples < RATE * 0.25) { routes.push({ start: window.start / RATE, end: window.end / RATE, skipped: "no-speech" }); continue; }
    const segment = samples.subarray(window.start, window.end);
    const { input_features } = await small.processor(segment);
    const stopping_criteria = [(ids) => { check(); return ids.map(() => false); }];
    // Detection always uses multilingual Small, NEVER Vietnamese-finetuned Pho.
    const detected = await small.model.generate({ inputs: input_features, decoder_input_ids: [config.decoder_start_token_id], max_new_tokens: 1, return_timestamps: false, begin_suppress_tokens: null, suppress_tokens: [], stopping_criteria });
    const language = languageIds.get(Number(detected.tolist()[0].at(-1)));
    if (language !== "vi" && language !== "en") throw fail("Không xác định được tiếng Việt/Anh để chọn model.", "LANGUAGE");
    const usePho = language === "vi" && Boolean(pho);
    const chosen = usePho ? pho : small;
    routes.push({ start: window.start / RATE, end: window.end / RATE, language, model: usePho ? "PhoWhisper" : "Small" });
    const sequence = await chosen.model.generate({ inputs: input_features, language, task: "transcribe", return_timestamps: false, max_new_tokens: Math.min(384, Math.max(64, Math.ceil(segment.length / RATE * 14))), stopping_criteria });
    check();
    const tokens = sequence.tolist()[0].map(Number);
    const eos = chosen.model.generation_config.eos_token_id;
    if (!(Array.isArray(eos) ? eos : [eos]).includes(tokens.at(-1))) throw fail("Bản chép bị ngắt, không trả thành công một phần.", "TRUNCATED");
    const text = chosen.tokenizer.decode(tokens, { skip_special_tokens: true }).trim();
    if (hasRepetitiveTranscript(text)) throw fail("Bản chép lặp bất thường.", "REPETITION");
    if (text) chunks.push({ text, start: window.start / RATE, end: window.end / RATE });
  }
  if (!chunks.length) throw fail("Không nhận dạng được lời nói.", "NO_SPEECH");
  const languages = new Set(routes.filter(route => route.language).map(route => route.language));
  return { text: chunks.map(chunk => chunk.text).join(" "), chunks, routes, vad: activity, language: languages.size === 1 ? [...languages][0] : "mixed", elapsed_ms: Math.round(now() - started), timestamp_precision: "segment" };
}
