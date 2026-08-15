import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { embedTexts } from "../src/lib/embedding/client";
import { searchByVector } from "../src/lib/search/hybrid-search";
import {
  getSqliteVectorStore,
  toSqliteVectorBlob,
} from "../src/lib/vector/sqlite-vector-store";

const query = "tai lieu giai thich decision tree cho nguoi moi";
const seedText = "Decision tree is a beginner friendly machine learning model that splits data by questions until it reaches a prediction.";
let documentId = "";
try {
  const document = await db.document.create({
    data: {
      title: "Decision tree basics",
      originalFileName: "decision-tree-basics.pdf",
      fileType: "PDF",
      filePath: "smoke/decision-tree-basics.pdf",
      fileSize: 1024,
      textContent: seedText,
      language: "en",
      primaryTopic: "Machine Learning",
      difficulty: "BEGINNER",
      status: "READY",
    },
  });
  documentId = document.id;
  const chunk = await db.documentChunk.create({
    data: {
      documentId: document.id,
      chunkIndex: 0,
      content: seedText,
      pageNumber: 1,
      sourceLabel: "Trang 1",
    },
  });

  const [chunkEmbedding] = (await embedTexts([seedText])).embeddings;
  getSqliteVectorStore().upsertChunkEmbedding(chunk.id, chunkEmbedding);
  await db.documentChunk.update({
    where: { id: chunk.id },
    data: { embedding: toSqliteVectorBlob(chunkEmbedding) },
  });
  const [result] = await searchByVector(query, {}, 1);

  assert.ok(result, "Semantic search must return a result");
  assert.ok(result.chunkId, "Result must identify the matched chunk");
  assert.ok(result.sourceLabel, "Result must include a source label");
  assert.ok(result.pageNumber, "PDF result must include a page number");

  console.log(JSON.stringify({ query, ...result }, null, 2));
} finally {
  if (documentId) await db.document.deleteMany({ where: { id: documentId } });
  await db.$disconnect();
}
