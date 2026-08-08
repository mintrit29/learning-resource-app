import assert from "node:assert/strict";
import {
  DEFAULT_EMBEDDING_REQUEST_BATCH_SIZE,
  MAX_EMBEDDING_REQUEST_BATCH_SIZE,
  resolveEmbeddingRequestBatchSize,
} from "../src/lib/embedding/config.ts";

const originalBatchSize = process.env.EMBEDDING_REQUEST_BATCH_SIZE;
delete process.env.EMBEDDING_REQUEST_BATCH_SIZE;
assert.equal(resolveEmbeddingRequestBatchSize(), 16);
if (originalBatchSize === undefined) {
  delete process.env.EMBEDDING_REQUEST_BATCH_SIZE;
} else {
  process.env.EMBEDDING_REQUEST_BATCH_SIZE = originalBatchSize;
}
assert.equal(
  resolveEmbeddingRequestBatchSize(""),
  DEFAULT_EMBEDDING_REQUEST_BATCH_SIZE,
);
assert.equal(resolveEmbeddingRequestBatchSize(" 8 "), 8);
assert.equal(resolveEmbeddingRequestBatchSize("32"), 32);
assert.equal(MAX_EMBEDDING_REQUEST_BATCH_SIZE, 32);

assert.throws(
  () => resolveEmbeddingRequestBatchSize("8.5"),
  /phải là số nguyên/,
);
assert.throws(
  () => resolveEmbeddingRequestBatchSize("0"),
  /phải nằm trong khoảng 1-32/,
);
assert.throws(
  () => resolveEmbeddingRequestBatchSize("33"),
  /phải nằm trong khoảng 1-32/,
);

console.log("PASS embedding config: request batch is validated and configurable");
