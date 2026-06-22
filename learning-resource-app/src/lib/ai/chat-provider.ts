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

export async function listProviderModels(config: ProviderConfig) {
  const type = config.type as ProviderType;
  const baseUrl = normalizeBaseUrl(config.baseUrl ?? "");
  if (type === "OLLAMA") {
    const response = await request(`${baseUrl}/api/tags`, { method: "GET" });
    if (!response.ok) throw new Error(`Ollama trả về HTTP ${response.status}`);
    const data = await response.json() as { models?: Array<{ name?: string }> };
    return (data.models ?? []).map((model) => model.name).filter((name): name is string => Boolean(name));
  }

  const apiKey = decryptApiKey(config.apiKeyEncrypted);
  const response = await request(`${baseUrl}/models`, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Provider trả về HTTP ${response.status}: ${body.slice(0, 180)}`);
  }
  const data = await response.json() as { data?: Array<{ id?: string }> };
  return (data.data ?? []).map((model) => model.id).filter((id): id is string => Boolean(id));
}

export async function testProviderConnection(config: ProviderConfig) {
  const type = config.type as ProviderType;
  const baseUrl = normalizeBaseUrl(config.baseUrl ?? "");
  if (type === "OLLAMA") {
    const response = await request(`${baseUrl}/api/tags`, { method: "GET" });
    if (!response.ok) throw new Error(`Ollama trả về HTTP ${response.status}`);
    const data = await response.json() as { models?: Array<{ name?: string }> };
    const names = data.models?.map((model) => model.name).filter(Boolean) ?? [];
    if (config.defaultChatModel && names.length && !names.includes(config.defaultChatModel)) {
      throw new Error(`Không tìm thấy model ${config.defaultChatModel} trong Ollama`);
    }
    return "Kết nối Ollama thành công";
  }

  const apiKey = decryptApiKey(config.apiKeyEncrypted);
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
    const body = await response.text();
    throw new Error(`Provider trả về HTTP ${response.status}: ${body.slice(0, 180)}`);
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
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.defaultChatModel,
          messages,
          stream: false,
          format: "json",
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Ollama trả về HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
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
      throw new Error(`Provider trả về HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Provider không trả về nội dung");
    return content;
  } finally {
    clearTimeout(timeout);
  }
}
