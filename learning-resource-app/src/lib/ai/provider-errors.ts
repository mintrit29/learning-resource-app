const MAX_PUBLIC_MESSAGE_LENGTH = 180;

export class AiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProviderError";
  }
}

function compact(message: string) {
  const normalized = message.replace(/\s+/g, " ").trim();
  return normalized.length > MAX_PUBLIC_MESSAGE_LENGTH
    ? `${normalized.slice(0, MAX_PUBLIC_MESSAGE_LENGTH - 1)}…`
    : normalized;
}

export function aiHttpError(status: number) {
  if (status === 400 || status === 422) {
    return new AiProviderError("Yêu cầu không hợp lệ. Kiểm tra Base URL và tên model.");
  }
  if (status === 401) {
    return new AiProviderError("API key không hợp lệ hoặc đã hết hạn.");
  }
  if (status === 403) {
    return new AiProviderError("API key không có quyền dùng model này.");
  }
  if (status === 404) {
    return new AiProviderError("Không tìm thấy API hoặc model. Kiểm tra Base URL và tên model.");
  }
  if (status === 408 || status === 504) {
    return new AiProviderError("Kết nối quá thời gian. Hãy thử lại.");
  }
  if (status === 429) {
    return new AiProviderError("Đã vượt giới hạn yêu cầu. Hãy thử lại sau.");
  }
  if (status >= 500) {
    return new AiProviderError("Dịch vụ AI đang gặp lỗi. Hãy thử lại sau.");
  }
  return new AiProviderError(`Không thể kết nối dịch vụ AI (HTTP ${status}).`);
}

export function safeAiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AiProviderError) return compact(error.message);

  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (name === "AbortError" || /abort|timed?\s*out|timeout/.test(message)) {
    return "Kết nối quá thời gian. Hãy thử lại.";
  }
  if (/invalid url|failed to parse url|url is invalid/.test(message)) {
    return "Base URL không hợp lệ.";
  }
  if (/fetch failed|econnrefused|enotfound|ehostunreach|network|socket/.test(message)) {
    return "Không kết nối được đến dịch vụ AI. Kiểm tra Base URL và dịch vụ đang chạy.";
  }
  if (/api key.*mã hóa|encrypted.*api key|bad decrypt|authenticate data/.test(message)) {
    return "Không đọc được API key đã lưu. Hãy nhập lại API key.";
  }
  if (name === "SyntaxError" || name === "ZodError") {
    return "AI trả về dữ liệu không đúng định dạng. Hãy thử lại hoặc đổi model.";
  }

  return compact(fallback);
}
