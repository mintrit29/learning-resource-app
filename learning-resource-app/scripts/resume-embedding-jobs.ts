import { JobStatus, JobType } from "../src/generated/prisma/enums";
import { db } from "../src/lib/db";
import { embedDocumentChunks } from "../src/lib/embedding/embed-document";

const jobs = await db.analysisJob.findMany({
  where: {
    type: JobType.EMBED_DOCUMENT,
    status: { in: [JobStatus.PENDING, JobStatus.PROCESSING] },
  },
  orderBy: { createdAt: "asc" },
  include: { document: { select: { title: true } } },
});

for (const job of jobs) {
  console.log(`Resume embedding: ${job.document.title} từ ${job.progress}%`);
  await embedDocumentChunks(job.documentId, job.id);
  const result = await db.analysisJob.findUnique({ where: { id: job.id } });
  console.log(`${result?.status}: ${result?.progress}%`);
}

await db.$disconnect();
