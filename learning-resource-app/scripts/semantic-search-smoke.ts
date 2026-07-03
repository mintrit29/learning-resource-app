import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { embedTexts, toPgVector } from "../src/lib/embedding/client";

type Result = {
  chunkId: string;
  documentId: string;
  title: string;
  pageNumber: number | null;
  sourceLabel: string | null;
  score: number;
};

const query = "tai lieu giai thich decision tree cho nguoi moi";
const seedText = "Decision tree is a beginner friendly machine learning model that splits data by questions until it reaches a prediction.";
const suffix = randomUUID();
const owner = await db.user.create({ data: { email: `semantic-smoke-${suffix}@example.test` } });

try {
  const document = await db.document.create({
    data: {
      userId: owner.id,
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
  const chunk = await db.documentChunk.create({
    data: {
      documentId: document.id,
      chunkIndex: 0,
      content: seedText,
      pageNumber: 1,
      sourceLabel: "Trang 1",
    },
  });

  const [chunkEmbedding, queryEmbedding] = (await embedTexts([seedText, query])).embeddings;
  await db.$executeRawUnsafe('UPDATE "DocumentChunk" SET "embedding" = $1::vector WHERE "id" = $2', toPgVector(chunkEmbedding), chunk.id);
  const vector = toPgVector(queryEmbedding);
  const [result] = await db.$queryRawUnsafe<Result[]>(
    `SELECT
      c."id" AS "chunkId",
      d."id" AS "documentId",
      d."title",
      c."pageNumber",
      c."sourceLabel",
      (1 - (c."embedding" <=> $1::vector))::float8 AS "score"
    FROM "DocumentChunk" c
    JOIN "Document" d ON d."id" = c."documentId"
    WHERE d."userId" = $2 AND c."embedding" IS NOT NULL
    ORDER BY c."embedding" <=> $1::vector
    LIMIT 1`,
    vector,
    owner.id,
  );

  assert.ok(result, "Semantic search must return a result");
  assert.ok(result.chunkId, "Result must identify the matched chunk");
  assert.ok(result.sourceLabel, "Result must include a source label");
  assert.ok(result.pageNumber, "PDF result must include a page number");

  console.log(JSON.stringify({ query, ...result }, null, 2));
} finally {
  await db.user.delete({ where: { id: owner.id } });
  await db.$disconnect();
}
