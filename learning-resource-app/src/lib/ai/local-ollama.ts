export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";

export function isLoopbackUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (url.protocol === "http:" || url.protocol === "https:") && (
      hostname === "localhost"
      || hostname === "127.0.0.1"
      || hostname.startsWith("127.")
      || hostname === "::1"
      || hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

export function localOllamaBaseUrl(value: string | null | undefined) {
  const candidate = (value || DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, "");
  return isLoopbackUrl(candidate) ? candidate : DEFAULT_OLLAMA_BASE_URL;
}
