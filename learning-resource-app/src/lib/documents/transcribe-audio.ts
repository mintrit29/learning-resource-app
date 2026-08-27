export type SupportedAudioExtension = "mp3" | "wav" | "m4a";

export type AudioTranscriptChunk = {
  text: string;
  start: number;
  end: number | null;
};

type TranscriptionResponse = {
  model: string;
  language: "vi" | "en";
  text: string;
  chunks: AudioTranscriptChunk[];
  duration_seconds: number;
  elapsed_ms: number;
};

function getLocalRuntimeUrl() {
  return (process.env.EMBEDDING_SERVICE_URL ?? "http://127.0.0.1:8001").replace(/\/+$/, "");
}

export async function transcribeAudio(
  buffer: Buffer,
  extension: SupportedAudioExtension,
): Promise<TranscriptionResponse> {
  const response = await fetch(`${getLocalRuntimeUrl()}/transcribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Audio-Extension": extension,
    },
    body: new Uint8Array(buffer),
    signal: AbortSignal.timeout(60 * 60 * 1000),
  }).catch((error) => {
    throw new Error(`Không thể kết nối bộ nhận dạng âm thanh: ${error instanceof Error ? error.message : "unknown error"}`);
  });

  const payload = await response.json().catch(() => null) as (TranscriptionResponse & { detail?: string }) | null;
  if (!response.ok || !payload) {
    throw new Error(payload?.detail ?? `Bộ nhận dạng âm thanh trả lỗi ${response.status}`);
  }
  return payload;
}

export function formatTranscriptTimestamp(seconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}
