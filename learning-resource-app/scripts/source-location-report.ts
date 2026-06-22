import { db } from "../src/lib/db";

const rows = await db.$queryRawUnsafe<Array<{
  title: string;
  total: number;
  located: number;
  embedded: number;
}>>(`
  SELECT
    d."title",
    COUNT(*)::int AS "total",
    COUNT(c."sourceLabel")::int AS "located",
    COUNT(c."embedding")::int AS "embedded"
  FROM "Document" d
  JOIN "DocumentChunk" c ON c."documentId" = d."id"
  GROUP BY d."id", d."title"
  ORDER BY d."createdAt"
`);

console.table(rows);
await db.$disconnect();
