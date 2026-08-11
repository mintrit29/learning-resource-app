import { decryptApiKey, normalizeBaseUrl, type ProviderType } from "@/lib/ai/provider-config";
import { AiProviderError, aiHttpError } from "@/lib/ai/provider-errors";

type ProviderConfig = {
  type: string;
  baseUrl: string | null;
  apiKeyEncrypted: string | null;
  defaultChatModel: string | null;
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

async function request(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson<T>(response: Response, source: string) {
  try {
    return await response.json() as T;
  } catch {
    throw new AiProviderError(`${source} trả về dữ liệu không hợp lệ.`);
  }
}

async function requestOllama(baseUrl: string, path: string, init: RequestInit) {
  try {
    return await request(`${baseUrl}${path}`, init);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new AiProviderError("Không kết nối được Ollama. Hãy mở Ollama và kiểm tra Base URL.");
  }
}

async function fetchOllama(baseUrl: string, path: string, init: RequestInit) {
  try {
    return await fetch(`${baseUrl}${path}`, init);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new AiProviderError("Không kết nối được Ollama. Hãy mở Ollama và kiểm tra Base URL.");
  }
}

function bearerHeaders(apiKey: string, includeJson = false) {
  return {
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };
}

export async function listProviderModels(config: ProviderConfig) {
  const type = config.type as ProviderType;
  const baseUrl = normalizeBaseUrl(config.baseUrl ?? "");
  if (type === "OLLAMA") {
    const response = await requestOllama(baseUrl, "/api/tags", { method: "GET" });
    if (!response.ok) throw aiHttpError(response.status);
    const data = await readJson<{ models?: Array<{ name?: string }> }>(response, "Ollama");
    return (data.models ?? []).map((model) => model.name).filter((name): name is string => Boolean(name));
  }

  const apiKey = decryptApiKey(config.apiKeyEncrypted);
  const response = await request(`${baseUrl}/models`, {
    method: "GET",
    headers: bearerHeaders(apiKey),
  });
  if (!response.ok) {
    throw aiHttpError(response.status);
  }
  const data = await readJson<{ data?: Array<{ id?: string }> }>(response, "Dịch vụ AI");
  return (data.data ?? []).map((model) => model.id).filter((id): id is string => Boolean(id));
}

export async function testProviderConnection(config: ProviderConfig) {
  const type = config.type as ProviderType;
  const baseUrl = normalizeBaseUrl(config.baseUrl ?? "");
  if (type === "OLLAMA") {
    const response = await requestOllama(baseUrl, "/api/tags", { method: "GET" });
    if (!response.ok) throw aiHttpError(response.status);
    const data = await readJson<{ models?: Array<{ name?: string }> }>(response, "Ollama");
    const names = data.models?.map((model) => model.name).filter(Boolean) ?? [];
    if (!names.length) {
      throw new AiProviderError("Ollama chưa có model. Hãy tải một model rồi thử lại.");
    }
    if (config.defaultChatModel && names.length && !names.includes(config.defaultChatModel)) {
      throw new AiProviderError("Model đã chọn không có trong Ollama.");
    }
    return "Kết nối Ollama thành công";
  }

  const apiKey = decryptApiKey(config.apiKeyEncrypted);
  if (!config.defaultChatModel) {
    throw new AiProviderError("Chưa chọn chat model.");
  }
  const response = await request(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: config.defaultChatModel,
      messages: [{ role: "user", content: "Reply with OK only." }],
      max_tokens: 8,
    }),
  });
  if (!response.ok) {
    throw aiHttpError(response.status);
  }
  return "Kết nối model thành công";
}

export async function completeChat(
  config: ProviderConfig,
  messages: ChatMessage[],
) {
  const type = config.type as ProviderType;
  const baseUrl = normalizeBaseUrl(config.baseUrl ?? "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 150_000);

  try {
    if (type === "OLLAMA") {
      const response = await fetchOllama(baseUrl, "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.defaultChatModel,
          messages,
          stream: false,
          format: "json",
          think: false,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw aiHttpError(response.status);
      }
      const data = await readJson<{ message?: { content?: string } }>(response, "Ollama");
      if (!data.message?.content) throw new AiProviderError("Ollama không trả về nội dung.");
      return data.message.content;
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: bearerHeaders(decryptApiKey(config.apiKeyEncrypted), true),
      body: JSON.stringify({
        model: config.defaultChatModel,
        messages,
        max_tokens: 2500,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw aiHttpError(response.status);
    }
    const data = await readJson<{ choices?: Array<{ message?: { content?: string } }> }>(response, "Dịch vụ AI");
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new AiProviderError("Dịch vụ AI không trả về nội dung.");
    return content;
  } finally {
    clearTimeout(timeout);
  }
}
