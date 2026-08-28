export const VOICE_MAX_SECONDS = 30;
export const VOICE_MAX_BYTES = 2 * 1024 * 1024;
export const VOICE_TIMEOUT_MS = 120_000;

export class VoiceInputError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export function normalizeVoiceQuery(value: unknown) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (text.length < 2 || !/[\p{L}\p{N}]/u.test(text)) throw new VoiceInputError("Chưa nghe rõ lời nói. Hãy thử nói lại gần mic hơn.", 422);
  if (text.length > 500) throw new VoiceInputError("Câu nói quá dài. Hãy nói ngắn hơn để tìm tài liệu (tối đa 500 ký tự).", 422);
  return text;
}

export async function readVoiceBody(request: Request) {
  // Next dev can rebuild request.url with localhost while Electron uses 127.0.0.1.
  // Use the actual HTTP Host (never forwarded headers), still requiring same-origin loopback.
  const url = new URL(request.url);
  let originAllowed = false;
  try {
    const target = new URL(`${url.protocol}//${request.headers.get("host") || url.host}`);
    originAllowed = target.protocol === "http:" && target.hostname === "127.0.0.1"
      && !target.username && !target.password && request.headers.get("origin") === target.origin;
  } catch { /* Invalid Host/Origin is denied. */ }
  if (!originAllowed) throw new VoiceInputError("Yêu cầu microphone không đến từ ứng dụng.", 403);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "audio/webm") throw new VoiceInputError("Định dạng ghi âm không được hỗ trợ.", 415);
  if (Number(request.headers.get("content-length")) > VOICE_MAX_BYTES) throw new VoiceInputError("Bản ghi quá lớn. Hãy nói ngắn hơn.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new VoiceInputError("Bản ghi trống.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      request.signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > VOICE_MAX_BYTES) { await reader.cancel(); throw new VoiceInputError("Bản ghi quá lớn. Hãy nói ngắn hơn.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const audio = Buffer.concat(chunks);
  if (audio.length < 16) throw new VoiceInputError("Bản ghi quá ngắn hoặc trống.");
  if (!audio.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) throw new VoiceInputError("Bản ghi âm không hợp lệ.", 415);
  return audio;
}
