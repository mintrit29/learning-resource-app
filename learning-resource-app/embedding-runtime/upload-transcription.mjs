// Uploaded audio only; the service always supplies the verified Silero detector.
const RATE = 16000;

function transcriptionError(message, statusCode = 422) {
  return Object.assign(new Error(message), { statusCode });
}

export function hasSpeechEnergy(samples) {
  let energy = 0;
  for (const sample of samples) energy += sample * sample;
  return samples.length > 0 && Number.isFinite(energy) && Math.sqrt(energy / samples.length) >= 0.001;
}

export function hasRepetitiveTranscript(text) {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  // Only reject strong consecutive loops, not ordinary repeated technical vocabulary.
  for (let size = 1; size <= 12; size++) {
    let repeated = 0;
    for (let i = size; i < words.length; i++) {
      repeated = words[i] === words[i - size] ? repeated + 1 : 0;
      if (repeated >= Math.max(12, size * 3)) return true;
    }
  }
  return false;
}

export function splitUploadAudio(samples) {
  const windows = [];
  let start = 0;
  while (start < samples.length) {
    let end = Math.min(samples.length, start + 30 * RATE);
    if (end < samples.length) {
      // Find a quiet 200 ms interval in seconds 20–30. No overlapped audio is
      // transcribed twice; every sample belongs to exactly one window.
      const width = RATE / 5;
      const maximum = end;
      let bestEnergy = Infinity;
      for (let offset = start + 20 * RATE; offset <= maximum - width; offset += RATE / 20) {
        let energy = 0;
        for (let i = offset; i < offset + width; i++) energy += samples[i] * samples[i];
        // Select the last equally quiet gap, avoiding unnecessarily short windows.
        if (energy <= bestEnergy) { bestEnergy = energy; end = offset + width / 2; }
      }
    }
    windows.push({ start, end });
    start = end;
  }
  return windows;
}

export async function transcribeUploadedSamples(samples, transcriber, { cancelled = () => false, now = () => performance.now(), vad } = {}) {
  if (!hasSpeechEnergy(samples)) throw transcriptionError("Không nghe thấy lời nói trong file âm thanh.");
  const started = now();
  // Cooperative deadline is checked between decoder tokens. It cannot interrupt
  // an individual native ONNX call that is stuck inside the runtime.
  const deadline = started + Math.min(55 * 60_000, Math.max(90_000, samples.length / RATE * 5000));
  const check = () => {
    if (cancelled()) throw transcriptionError("Đã dừng chép lời âm thanh.", 499);
    if (now() >= deadline) throw transcriptionError("Chép lời mất quá nhiều thời gian. Hãy thử chia file âm thanh thành các đoạn ngắn hơn.", 504);
  };
  check();
  const activity = vad ? await vad.detect(samples, check) : null;
  check();
  if (activity && !activity.intervals.length) throw transcriptionError("Không phát hiện lời nói trong file âm thanh; không chép tiếng nhiễu.");
  const chunks = [];
  const languages = new Set();
  const config = transcriber.model.generation_config;
  const languageIds = new Map(Object.entries(config.lang_to_id).map(([token, id]) => [id, token.slice(2, -2)]));
  for (const window of splitUploadAudio(samples)) {
    check();
    if (activity) {
      const speechSamples = activity.intervals.reduce((sum, span) =>
        sum + Math.max(0, Math.min(span.end, window.end) - Math.max(span.start, window.start)), 0);
      if (speechSamples < RATE * 0.25) continue;
    }
    const segment = samples.subarray(window.start, window.end);
    if (!hasSpeechEnergy(segment)) continue;
    const { input_features } = await transcriber.processor(segment);
    check();
    const stopping_criteria = [(ids) => { check(); return ids.map(() => false); }];
    const detected = await transcriber.model.generate({
      inputs: input_features, decoder_input_ids: [config.decoder_start_token_id],
      max_new_tokens: 1, return_timestamps: false, begin_suppress_tokens: null, suppress_tokens: [], stopping_criteria,
    });
    const language = languageIds.get(Number(detected.tolist()[0].at(-1)));
    if (language !== "vi" && language !== "en") {
      throw transcriptionError("Chưa nhận diện chắc chắn tiếng Việt hoặc tiếng Anh. Hãy thử file có lời nói rõ hơn.");
    }
    languages.add(language);
    const limit = Math.min(384, Math.max(64, Math.ceil(segment.length / RATE * 14)));
    const sequence = await transcriber.model.generate({
      inputs: input_features, language, task: "transcribe", return_timestamps: false,
      max_new_tokens: limit, stopping_criteria,
    });
    check();
    const tokens = sequence.tolist()[0].map(Number);
    const eos = Array.isArray(config.eos_token_id) ? config.eos_token_id : [config.eos_token_id];
    if (!eos.includes(tokens.at(-1))) {
      throw transcriptionError("Bản chép lời bị ngắt hoặc lặp bất thường. Hãy thử file ngắn hơn, có lời nói rõ hơn.");
    }
    const text = transcriber.tokenizer.decode(tokens, { skip_special_tokens: true }).trim();
    if (hasRepetitiveTranscript(text)) {
      throw transcriptionError("Bản chép lời bị lặp bất thường nên chưa được lưu. Hãy thử file có lời nói rõ hơn.");
    }
    if (text) chunks.push({ text, start: window.start / RATE, end: window.end / RATE });
  }
  if (!chunks.length) throw transcriptionError("Không nhận dạng được lời nói trong file âm thanh.");
  return {
    language: languages.size > 1 ? "mixed" : [...languages][0],
    text: chunks.map(chunk => chunk.text).join(" "), chunks,
    timestamp_precision: "segment", duration_seconds: Math.round(samples.length / RATE),
    elapsed_ms: Math.round(now() - started),
  };
}
