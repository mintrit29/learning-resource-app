import { JobType } from "../src/generated/prisma/enums";
import { db } from "../src/lib/db";
import { embedDocumentChunks } from "../src/lib/embedding/embed-document";

const documents = await db.document.findMany({
  where: { chunks: { some: {} } },
  select: { id: true, title: true },
});

for (const document of documents) {
  const pending = await db.documentChunk.count({
    where: { documentId: document.id, embedding: null },
  });
  if (pending === 0) continue;

  const job = await db.analysisJob.create({
    data: { documentId: document.id, type: JobType.EMBED_DOCUMENT },
    select: { id: true },
  });
  console.log(`Đang embedding ${pending} chunks còn thiếu: ${document.title}`);
  await embedDocumentChunks(document.id, job.id);
  const result = await db.analysisJob.findUnique({ where: { id: job.id } });
  console.log(`${result?.status}: ${result?.errorMessage ?? "hoàn thành"}`);
}

await db.$disconnect();
