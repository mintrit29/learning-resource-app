const TECHNICAL_DETAIL = /(?:[a-z]:\\|\/users\/|\/home\/|node:|\bat\s+[\w$.<>]+|prisma|sqlite|unexpected token|<!doctype|server action|typeerror|referenceerror|syntaxerror|econn\w*|epipe|eperm|eacces|\{[\s\S]*\})/i;

export function toUserFacingError(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const normalized = raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const lower = normalized.toLowerCase();

  if (/ebusy|resource busy|being used by another process|process cannot access the file/.test(lower)) {
    return "File đang được ứng dụng khác sử dụng. Hãy đóng file rồi thử lại.";
  }
  if (/enoent|no such file|cannot find the file/.test(lower)) {
    return "Không tìm thấy file gốc. Hãy thêm lại tài liệu rồi thử lại.";
  }
  if (/enospc|disk full|not enough space/.test(lower)) {
    return "Máy không còn đủ dung lượng trống để hoàn tất thao tác.";
  }
  if (/timed?\s*out|timeout/.test(lower)) {
    return "Xử lý mất quá nhiều thời gian và đã được dừng. Hãy thử lại.";
  }

  if (!normalized || normalized.length > 180 || TECHNICAL_DETAIL.test(normalized)) return fallback;
  return normalized;
}
