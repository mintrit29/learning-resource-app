import { JobStatus, JobType } from "../src/generated/prisma/enums";
import { db } from "../src/lib/db";

type CountRow = { count: bigint };

const job = await db.analysisJob.findFirst({
  where: { type: JobType.EMBED_DOCUMENT, status: JobStatus.COMPLETED },
  orderBy: { finishedAt: "desc" },
  include: { document: { select: { title: true } } },
});
const [row] = await db.$queryRawUnsafe<CountRow[]>(
  'SELECT COUNT(*)::bigint AS count FROM "DocumentChunk" WHERE "embedding" IS NOT NULL',
);

const elapsedSeconds = job?.startedAt && job.finishedAt
  ? (job.finishedAt.getTime() - job.startedAt.getTime()) / 1000
  : null;

console.log(JSON.stringify({
  document: job?.document.title ?? null,
  embeddedChunks: Number(row?.count ?? 0),
  elapsedSeconds,
  chunksPerSecond: elapsedSeconds ? Number(row?.count ?? 0) / elapsedSeconds : null,
}, null, 2));

await db.$disconnect();
