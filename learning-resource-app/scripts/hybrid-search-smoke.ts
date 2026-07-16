import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { searchByKeyword } from "../src/lib/search/hybrid-search";

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

  const accentlessResults = await searchByKeyword(owner.id, "co so du lieu transaction", {}, 10);
  assert.ok(accentlessResults.length > 0, "Accentless Vietnamese query must find accented content");
  assert.ok(accentlessResults.every((result) => result.documentId === ownedDocument.id), "Search must not leak another user's chunks");

  const filteredResults = await searchByKeyword(owner.id, "transaction", { fileType: "PPTX" }, 10);
  assert.equal(filteredResults.length, 0, "File type filter must be applied");

  console.log("PASS hybrid search SQL: accent-insensitive keyword, ownership and filters");
} finally {
  await db.user.deleteMany({ where: { id: { in: [owner.id, otherOwner.id] } } });
  await db.$disconnect();
}

