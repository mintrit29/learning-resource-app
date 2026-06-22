import assert from "node:assert/strict";
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

const query = "tài liệu giải thích decision tree cho người mới";
const embedded = await embedTexts([query]);
const vector = toPgVector(embedded.embeddings[0]);
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
  WHERE c."embedding" IS NOT NULL
  ORDER BY c."embedding" <=> $1::vector
  LIMIT 1`,
  vector,
);

assert.ok(result, "Semantic search must return a result");
assert.ok(result.chunkId, "Result must identify the matched chunk");
assert.ok(result.sourceLabel, "Result must include a source label");
assert.ok(result.pageNumber, "PDF result must include a page number");

console.log(JSON.stringify({ query, ...result }, null, 2));
await db.$disconnect();
