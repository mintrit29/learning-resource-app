import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { embedTexts, toPgVector } from "../src/lib/embedding/client";
import { hybridSearch, searchByKeyword, searchByVector } from "../src/lib/search/hybrid-search";

const suffix = randomUUID();
const owner = await db.user.create({ data: { email: `hybrid-owner-${suffix}@example.test` } });
const otherOwner = await db.user.create({ data: { email: `hybrid-other-${suffix}@example.test` } });

try {
  const ownedDocument = await db.document.create({
    data: {
      userId: owner.id,
      title: "Cơ sở dữ liệu cho người mới",
      originalFileName: "database.pdf",
      fileType: "PDF",
      filePath: "smoke/database.pdf",
      fileSize: 1024,
      primaryTopic: "Cơ sở dữ liệu",
      difficulty: "BEGINNER",
      status: "READY",
      chunks: {
        create: { chunkIndex: 0, content: "Transaction đảm bảo tính toàn vẹn của cơ sở dữ liệu.", pageNumber: 3, sourceLabel: "Trang 3" },
      },
    },
  });
  await db.document.create({
    data: {
      userId: otherOwner.id,
      title: "Tài liệu transaction riêng tư",
      originalFileName: "private.pdf",
      fileType: "PDF",
      filePath: "smoke/private.pdf",
      fileSize: 1024,
      status: "READY",
      chunks: { create: { chunkIndex: 0, content: "Transaction private content" } },
    },
  });
  const ownedChunk = await db.documentChunk.findFirstOrThrow({ where: { documentId: ownedDocument.id } });
  const [chunkEmbedding] = (await embedTexts([ownedChunk.content])).embeddings;
  await db.$executeRawUnsafe(
    'UPDATE "DocumentChunk" SET "embedding" = $1::vector WHERE "id" = $2',
    toPgVector(chunkEmbedding),
    ownedChunk.id,
  );

  const accentlessResults = await searchByKeyword(owner.id, "co so du lieu transaction", {}, 10);
  assert.ok(accentlessResults.length > 0, "Accentless Vietnamese query must find accented content");
  assert.ok(accentlessResults.every((result) => result.documentId === ownedDocument.id), "Search must not leak another user's chunks");

  const filteredResults = await searchByKeyword(owner.id, "transaction", { fileType: "PPTX" }, 10);
  assert.equal(filteredResults.length, 0, "File type filter must be applied");
  const difficultyFilteredResults = await searchByKeyword(owner.id, "transaction", { difficulty: "ADVANCED" }, 10);
  assert.equal(difficultyFilteredResults.length, 0, "Difficulty filter must be applied");
  const topicFilteredResults = await searchByKeyword(owner.id, "transaction", { topic: "Cơ sở dữ liệu" }, 10);
  assert.equal(topicFilteredResults.length, 1, "Topic filter must be applied");

  const vectorResults = await searchByVector(owner.id, "transaction co so du lieu cho nguoi moi", {}, 10);
  assert.ok(vectorResults.length > 0, "Vector retrieval must find the embedded chunk");
  const hybridResults = await hybridSearch(owner.id, "transaction co so du lieu cho nguoi moi", {});
  assert.equal(hybridResults.retrievalMode, "hybrid", "Embedding and keyword retrieval must both contribute");
  assert.equal(hybridResults.candidates[0]?.documentId, ownedDocument.id, "Owned relevant document must rank first");
  assert.ok(hybridResults.candidates[0]?.matchReasons.includes("Khớp ngữ nghĩa"));
  assert.ok(hybridResults.candidates[0]?.matchReasons.includes("Khớp từ khóa"));

  console.log("PASS hybrid search: accent-insensitive keyword, semantic merge, ownership and topic/difficulty/file filters");
} finally {
  await db.user.deleteMany({ where: { id: { in: [owner.id, otherOwner.id] } } });
  await db.$disconnect();
}
