import { JobType } from "../src/generated/prisma/enums";
import { db } from "../src/lib/db";
import { processDocumentPipeline } from "../src/lib/documents/process-document";

const documents = await db.document.findMany({
  where: {
    OR: [
      { jobs: { none: {} } },
      { chunks: { none: {} } },
    ],
  },
  select: { id: true, title: true },
});

if (documents.length === 0) {
  console.log("Không có tài liệu cần backfill.");
}

for (const document of documents) {
  console.log(`Đang xử lý: ${document.title}`);
  const jobs = await db.analysisJob.createManyAndReturn({
    data: [
      { documentId: document.id, type: JobType.EXTRACT_TEXT },
      { documentId: document.id, type: JobType.CHUNK_DOCUMENT },
      { documentId: document.id, type: JobType.EMBED_DOCUMENT },
    ],
    select: { id: true, type: true },
  });

  const extractionJobId = jobs.find((job) => job.type === JobType.EXTRACT_TEXT)?.id;
  const chunkJobId = jobs.find((job) => job.type === JobType.CHUNK_DOCUMENT)?.id;
  const embeddingJobId = jobs.find((job) => job.type === JobType.EMBED_DOCUMENT)?.id;
  if (!extractionJobId || !chunkJobId || !embeddingJobId) throw new Error("Không thể tạo backfill jobs");

  await processDocumentPipeline({ documentId: document.id, extractionJobId, chunkJobId, embeddingJobId });
  const chunkCount = await db.documentChunk.count({ where: { documentId: document.id } });
  console.log(`Hoàn thành: ${chunkCount} chunks`);
}

await db.$disconnect();
