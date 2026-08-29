// Small JSON mutations must always settle, even if the service hangs or sends HTML.
// Never retry mutations automatically: the server may have committed before disconnecting.
export async function requestJsonAction(
  url: string,
  init: RequestInit,
  fallback: string,
  options: { timeoutMs?: number; fetcher?: typeof fetch } = {},
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 30_000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("Ứng dụng phản hồi quá lâu. Hãy tải lại trang để kiểm tra kết quả trước khi thử lại."));
      controller.abort();
    }, timeoutMs);
  });
  const request = async () => {
    let response: Response;
    try {
      response = await (options.fetcher ?? fetch)(url, { ...init, signal: controller.signal });
    } catch {
      throw new Error("Không kết nối được tới ứng dụng. Hãy kiểm tra lại trạng thái trước khi thử lại.");
    }
    let data: unknown;
    try { data = await response.json(); } catch { throw new Error(`${fallback}. Ứng dụng trả về phản hồi không hợp lệ; hãy thử lại.`); }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error(`${fallback}. Ứng dụng trả về phản hồi không hợp lệ; hãy thử lại.`);
    }
    const result = data as Record<string, unknown>;
    if (!response.ok) throw new Error(typeof result.message === "string" && result.message.trim() ? result.message : fallback);
    return result;
  };
  try { return await Promise.race([request(), timeout]); }
  finally { clearTimeout(timer); }
}

export function actionErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
