const serviceUrl = process.env.EMBEDDING_SERVICE_URL ?? "http://127.0.0.1:8001";

type EmbedResponse = {
  model: string;
  dimensions: number;
  embeddings: number[][];
  elapsed_ms: number;
};

export async function embedTexts(texts: string[]): Promise<EmbedResponse> {
  const response = await fetch(`${serviceUrl}/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts }),
    signal: AbortSignal.timeout(10 * 60 * 1000),
  }).catch((error) => {
    throw new Error(
      `Không thể kết nối embedding service: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  });

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

export function toPgVector(vector: number[]) {
  if (vector.length !== 1024 || vector.some((value) => !Number.isFinite(value))) {
    throw new Error("Vector phải có đúng 1024 phần tử hữu hạn");
  }
  return `[${vector.join(",")}]`;
}
