import { JobStatus, JobType } from "../src/generated/prisma/enums";
import { db } from "../src/lib/db";

const job = await db.analysisJob.findFirst({
  where: { type: JobType.EMBED_DOCUMENT, status: JobStatus.COMPLETED },
  orderBy: { finishedAt: "desc" },
  include: { document: { select: { title: true } } },
});
const embeddedChunks = await db.documentChunk.count({
  where: { embedding: { not: null } },
});

const elapsedSeconds = job?.startedAt && job.finishedAt
  ? (job.finishedAt.getTime() - job.startedAt.getTime()) / 1000
  : null;

console.log(JSON.stringify({
  document: job?.document.title ?? null,
  embeddedChunks,
  elapsedSeconds,
  chunksPerSecond: elapsedSeconds ? embeddedChunks / elapsedSeconds : null,
}, null, 2));

await db.$disconnect();
