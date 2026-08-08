import assert from "node:assert/strict";

import {
  EMBEDDING_DIMENSIONS,
  SqliteVectorStore,
  cosineSimilarity,
  fromSqliteVectorBlob,
  toSqliteVectorBlob,
} from "../src/lib/vector/sqlite-vector-store.ts";

let store;

function unitVector(index) {
  const vector = new Array(EMBEDDING_DIMENSIONS).fill(0);
  vector[index] = 1;
  return vector;
}

try {
  const source = unitVector(12);
  const blob = toSqliteVectorBlob(source);
  assert.equal(blob.byteLength, EMBEDDING_DIMENSIONS * Float32Array.BYTES_PER_ELEMENT);
  assert.deepEqual([...fromSqliteVectorBlob(blob)], source);
  assert.throws(() => toSqliteVectorBlob([1, 2, 3]), /1024/);
  assert.equal(cosineSimilarity(source, source), 1);
  assert.equal(cosineSimilarity(source, unitVector(13)), 0);

  store = new SqliteVectorStore("file::memory:");
  store.upsertChunkEmbedding("chunk-near", source);
  store.upsertChunkEmbedding("chunk-far", unitVector(13));

  const matches = store.searchChunkEmbeddings(source, 2);
  assert.equal(matches.length, 2);
  assert.equal(matches[0].chunkId, "chunk-near");
  assert.equal(matches[0].distance, 0);
  assert.equal(matches[0].semanticScore, 1);
  assert.deepEqual(
    store.searchChunkEmbeddings(source, 2, ["chunk-far"]).map((match) => match.chunkId),
    ["chunk-far"],
  );
  assert.deepEqual(store.searchChunkEmbeddings(source, 2, []), []);

  store.upsertChunkEmbedding("chunk-near", unitVector(14));
  assert.equal(store.count(), 2, "Upsert must not duplicate a chunk vector");
  assert.equal(store.deleteChunkEmbeddings(["chunk-near", "chunk-near"]), 1);
  assert.equal(store.count(), 1);
  console.log("PASS sqlite vector store: BLOB validation, cosine KNN, upsert and delete");
} finally {
  store?.close();
}
