const serviceUrl = (process.env.EMBEDDING_SERVICE_URL ?? "http://127.0.0.1:8001").replace(/\/+$/, "");
const SERVICE_CONNECT_TIMEOUT_MS = 30_000;
const MODEL_READY_TIMEOUT_MS = 60 * 60 * 1000;

type EmbeddingHealth = {
  status: "loading" | "ready" | "error";
  error?: string | null;
};

type EmbedResponse = {
  model: string;
  dimensions: number;
  embeddings: number[][];
  elapsed_ms: number;
};

let embeddingReadyPromise: Promise<void> | null = null;

async function readEmbeddingHealth(): Promise<EmbeddingHealth | null> {
  return fetch(`${serviceUrl}/health`, {
    signal: AbortSignal.timeout(5_000),
    cache: "no-store",
  }).then(async (response) => {
    const body = await response.json().catch(() => null) as EmbeddingHealth | null;
    return body && typeof body.status === "string" ? body : null;
  }).catch(() => null);
}
async function waitForEmbeddingService() {
  const startedAt = Date.now();
  const connectDeadline = startedAt + SERVICE_CONNECT_TIMEOUT_MS;
  const modelDeadline = startedAt + MODEL_READY_TIMEOUT_MS;
  let hasConnected = false;

  while (Date.now() < modelDeadline) {
    const health = await readEmbeddingHealth();
    if (health) {
      hasConnected = true;
      if (health.status === "ready") return;
      if (health.status === "error") {
        throw new Error(`Không thể nạp model BGE-M3 local: ${health.error ?? "unknown error"}`);
      }
    } else if (!hasConnected && Date.now() >= connectDeadline) {
      throw new Error("Không thể khởi động embedding runtime local của ScholarFlow");
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error("Model BGE-M3 local tải quá thời gian cho phép");
}

function ensureEmbeddingServiceReady() {
  if (!embeddingReadyPromise) {
    embeddingReadyPromise = waitForEmbeddingService().catch((error) => {
      embeddingReadyPromise = null;
      throw error;
    });
  }
  return embeddingReadyPromise;
}

async function requestEmbeddings(texts: string[]) {
  return fetch(`${serviceUrl}/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts }),
    signal: AbortSignal.timeout(10 * 60 * 1000),
  });
}

export async function embedTexts(texts: string[]): Promise<EmbedResponse> {
  await ensureEmbeddingServiceReady();
  let response = await requestEmbeddings(texts).catch((error) => {
    embeddingReadyPromise = null;
    throw new Error(
      `Không thể kết nối embedding service: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  });

  if (response.status === 503) {
    embeddingReadyPromise = null;
    await ensureEmbeddingServiceReady();
    response = await requestEmbeddings(texts);
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Embedding service trả lỗi ${response.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as EmbedResponse;
  if (data.dimensions !== 1024 || data.embeddings.length !== texts.length) {
    throw new Error("Embedding service trả về vector không hợp lệ");
  }
  return data;
}

