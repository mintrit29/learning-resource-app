import { db } from "../src/lib/db";

const documents = await db.document.findMany({
  select: { id: true, title: true },
  orderBy: { createdAt: "asc" },
});
const rows = await Promise.all(documents.map(async (document) => ({
  title: document.title,
  total: await db.documentChunk.count({ where: { documentId: document.id } }),
  located: await db.documentChunk.count({
    where: { documentId: document.id, sourceLabel: { not: null } },
  }),
  embedded: await db.documentChunk.count({
    where: { documentId: document.id, embedding: { not: null } },
  }),
})));

console.table(rows);
await db.$disconnect();
