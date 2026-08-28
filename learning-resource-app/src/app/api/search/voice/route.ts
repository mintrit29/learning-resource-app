import { isWhisperReady } from "@/lib/desktop/component-availability";
import { normalizeVoiceQuery, readVoiceBody, VoiceInputError, VOICE_TIMEOUT_MS } from "@/lib/search/voice-search-input";

export const runtime = "nodejs";
const missing = "Cần tải Whisper Base trong Cài đặt → Thành phần cục bộ để tìm bằng giọng nói.";
const json = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  const ready = await isWhisperReady();
  return json({ ready, message: ready ? "" : missing });
}

export async function POST(request: Request) {
  const timeout = AbortSignal.timeout(VOICE_TIMEOUT_MS);
  const signal = AbortSignal.any([request.signal, timeout]);
  try {
    const audio = await readVoiceBody(request);
    if (!await isWhisperReady()) return json({ message: missing, code: "WHISPER_MISSING" }, 503);
    const base = new URL(process.env.EMBEDDING_SERVICE_URL ?? "http://127.0.0.1:8001");
    if (base.protocol !== "http:" || base.hostname !== "127.0.0.1") throw new Error("Invalid local runtime");
    const response = await fetch(new URL("/transcribe?mode=voice", base), {
      method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Audio-Extension": "webm" },
      body: new Uint8Array(audio), signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 413) return json({ message: "Bản ghi quá dài. Mỗi lần nói tối đa 30 giây." }, 413);
      if (response.status === 422) return json({ message: "Chưa nghe rõ lời nói. Hãy kiểm tra mic và thử lại." }, 422);
      if (response.status === 503) return json({ message: missing, code: "WHISPER_MISSING" }, 503);
      throw new Error("Transcription failed");
    }
    signal.throwIfAborted();
    return json({ text: normalizeVoiceQuery(data?.text) });
  } catch (error) {
    if (error instanceof VoiceInputError) return json({ message: error.message }, error.status);
    if (request.signal.aborted) return json({ message: "Đã hủy nhận dạng giọng nói." }, 499);
    if (timeout.aborted) return json({ message: "Nhận dạng đang mất quá lâu. Hãy thử lại khi máy bớt bận hoặc gõ trực tiếp." }, 504);
    return json({ message: "Không thể nhận dạng giọng nói. Kiểm tra Whisper trong Cài đặt và thử lại." }, 502);
  }
}
