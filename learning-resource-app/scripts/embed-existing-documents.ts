import { JobType } from "../src/generated/prisma/enums";
import { db } from "../src/lib/db";
import { embedDocumentChunks } from "../src/lib/embedding/embed-document";

const documents = await db.document.findMany({
  where: { chunks: { some: {} } },
  select: { id: true, title: true },
});

for (const document of documents) {
  const [pending] = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
    'SELECT COUNT(*)::bigint AS count FROM "DocumentChunk" WHERE "documentId" = $1 AND "embedding" IS NULL',
    document.id,
  );
  if (Number(pending?.count ?? 0) === 0) continue;

  const job = await db.analysisJob.create({
    data: { documentId: document.id, type: JobType.EMBED_DOCUMENT },
    select: { id: true },
  });
  console.log(`Đang embedding ${Number(pending.count)} chunks còn thiếu: ${document.title}`);
  await embedDocumentChunks(document.id, job.id);
  const result = await db.analysisJob.findUnique({ where: { id: job.id } });
  console.log(`${result?.status}: ${result?.errorMessage ?? "hoàn thành"}`);
}

await db.$disconnect();
