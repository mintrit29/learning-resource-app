export const DEFAULT_EMBEDDING_REQUEST_BATCH_SIZE = 16;
export const MAX_EMBEDDING_REQUEST_BATCH_SIZE = 32;

export function resolveEmbeddingRequestBatchSize(
  rawValue = process.env.EMBEDDING_REQUEST_BATCH_SIZE,
) {
  const normalizedValue = rawValue?.trim();
  if (!normalizedValue) return DEFAULT_EMBEDDING_REQUEST_BATCH_SIZE;

  if (!/^\d+$/.test(normalizedValue)) {
    throw new Error("EMBEDDING_REQUEST_BATCH_SIZE phải là số nguyên");
  }

  const batchSize = Number(normalizedValue);
  if (batchSize < 1 || batchSize > MAX_EMBEDDING_REQUEST_BATCH_SIZE) {
    throw new Error(
      `EMBEDDING_REQUEST_BATCH_SIZE phải nằm trong khoảng 1-${MAX_EMBEDDING_REQUEST_BATCH_SIZE}`,
    );
  }
  return batchSize;
}
