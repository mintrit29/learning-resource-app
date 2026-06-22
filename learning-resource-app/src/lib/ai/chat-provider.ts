import { decryptApiKey, normalizeBaseUrl, type ProviderType } from "@/lib/ai/provider-config";

type ProviderConfig = {
  type: string;
  baseUrl: string | null;
  apiKeyEncrypted: string | null;
  defaultChatModel: string | null;
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
