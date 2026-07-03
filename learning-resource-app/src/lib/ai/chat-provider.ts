import { decryptApiKey, normalizeBaseUrl, type ProviderType } from "@/lib/ai/provider-config";

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

async function readErrorBody(response: Response) {
  const body = await response.text().catch(() => "");
  if (!body) return "";
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string };
      message?: string;
      detail?: string;
    };
    return parsed.error?.message ?? parsed.message ?? parsed.detail ?? body;
  } catch {
    return body;
  }
}

function formatHttpError(source: string, status: number, body: string) {
  const detail = body.trim().replace(/\s+/g, " ").slice(0, 220);
  if (status === 401) return `${source} từ chối xác thực. Hãy kiểm tra API key. ${detail}`;
  if (status === 403) return `${source} không cho phép dùng model hoặc tài khoản hiện tại đã hết/quá giới hạn quyền. ${detail}`;
  if (status === 404) return `${source} không tìm thấy endpoint hoặc model. Hãy kiểm tra Base URL và tên model. ${detail}`;
  if (status === 429) return `${source} đang bị rate limit/quota. Chờ một lúc hoặc đổi model/provider. ${detail}`;
  if (status >= 500) return `${source} đang lỗi phía server. Thử lại sau hoặc đổi provider. ${detail}`;
  return `${source} trả về HTTP ${status}. ${detail}`;
}

function ollamaBaseUrlCandidates(baseUrl: string) {
  const candidates = [baseUrl];
  try {
    const parsed = new URL(baseUrl);
    if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
      parsed.hostname = "host.docker.internal";
      candidates.push(parsed.toString().replace(/\/+$/, ""));
    }
  } catch {
    // URL validation happens before this point.
  }
  return [...new Set(candidates)];
}

async function requestOllama(baseUrl: string, path: string, init: RequestInit) {
  const errors: string[] = [];
  for (const candidate of ollamaBaseUrlCandidates(baseUrl)) {
    try {
      return await request(`${candidate}${path}`, init);
    } catch (error) {
      errors.push(`${candidate}: ${error instanceof Error ? error.message : "request failed"}`);
    }
  }
  throw new Error(`Không kết nối được Ollama (${errors.join("; ")})`);
}

async function fetchOllama(baseUrl: string, path: string, init: RequestInit) {
  const errors: string[] = [];
  for (const candidate of ollamaBaseUrlCandidates(baseUrl)) {
    try {
      return await fetch(`${candidate}${path}`, init);
    } catch (error) {
      errors.push(`${candidate}: ${error instanceof Error ? error.message : "request failed"}`);
    }
  }
  throw new Error(`Không kết nối được Ollama (${errors.join("; ")})`);
}

export async function listProviderModels(config: ProviderConfig) {
  const type = config.type as ProviderType;
  const baseUrl = normalizeBaseUrl(config.baseUrl ?? "");
  if (type === "OLLAMA") {
    const response = await requestOllama(baseUrl, "/api/tags", { method: "GET" });
    if (!response.ok) throw new Error(formatHttpError("Ollama", response.status, await readErrorBody(response)));
    const data = await response.json() as { models?: Array<{ name?: string }> };
    return (data.models ?? []).map((model) => model.name).filter((name): name is string => Boolean(name));
  }

  const apiKey = decryptApiKey(config.apiKeyEncrypted);
  const response = await request(`${baseUrl}/models`, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    throw new Error(formatHttpError("Provider", response.status, await readErrorBody(response)));
  }
  const data = await response.json() as { data?: Array<{ id?: string }> };
  return (data.data ?? []).map((model) => model.id).filter((id): id is string => Boolean(id));
}

export async function testProviderConnection(config: ProviderConfig) {
  const type = config.type as ProviderType;
  const baseUrl = normalizeBaseUrl(config.baseUrl ?? "");
  if (type === "OLLAMA") {
    const response = await requestOllama(baseUrl, "/api/tags", { method: "GET" });
    if (!response.ok) throw new Error(formatHttpError("Ollama", response.status, await readErrorBody(response)));
    const data = await response.json() as { models?: Array<{ name?: string }> };
    const names = data.models?.map((model) => model.name).filter(Boolean) ?? [];
    if (!names.length) {
      throw new Error("Kết nối được Ollama nhưng chưa thấy model nào. Hãy pull/chọn model trước rồi tải lại danh sách model.");
    }
    if (config.defaultChatModel && names.length && !names.includes(config.defaultChatModel)) {
      throw new Error(`Không tìm thấy model ${config.defaultChatModel} trong Ollama`);
    }
    return "Kết nối Ollama thành công";
  }

  const apiKey = decryptApiKey(config.apiKeyEncrypted);
  if (!config.defaultChatModel) {
    throw new Error("Chưa chọn chat model. Hãy tải danh sách model hoặc nhập đúng model trước khi test.");
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
    throw new Error(formatHttpError("Provider", response.status, await readErrorBody(response)));
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
        throw new Error(formatHttpError("Ollama", response.status, await readErrorBody(response)));
      }
      const data = await response.json() as { message?: { content?: string } };
      if (!data.message?.content) throw new Error("Ollama không trả về nội dung");
      return data.message.content;
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${decryptApiKey(config.apiKeyEncrypted)}`,
      },
      body: JSON.stringify({
        model: config.defaultChatModel,
        messages,
        max_tokens: 2500,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(formatHttpError("Provider", response.status, await readErrorBody(response)));
    }
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Provider không trả về nội dung");
    return content;
  } finally {
    clearTimeout(timeout);
  }
}
