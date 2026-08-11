import { JobStatus, JobType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import {
  enqueueDocumentAnalysis,
  enqueueDocumentEmbedding,
  enqueueDocumentPipeline,
} from "@/lib/documents/document-processing-queue";
import { resetDocumentJob } from "@/lib/documents/processing-jobs";

const ACTIVE_JOB_STATUSES = [JobStatus.PENDING, JobStatus.PROCESSING];

function isActive(status: JobStatus | undefined) {
  return status === JobStatus.PENDING || status === JobStatus.PROCESSING;
}

function isTransientEmbeddingFailure(errorMessage: string | null | undefined) {
  const message = errorMessage?.toLocaleLowerCase("vi") ?? "";
  return message.includes("embedding runtime local")
    || message.includes("kết nối embedding service");
}

export async function recoverInterruptedDocumentProcessing() {
  const documents = await db.document.findMany({
    where: {
      OR: [
        { jobs: { some: { status: { in: ACTIVE_JOB_STATUSES } } } },
        {
          jobs: {
            some: {
              type: JobType.EMBED_DOCUMENT,
              status: JobStatus.FAILED,
              errorMessage: { contains: "embedding" },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      jobs: {
        orderBy: { createdAt: "desc" },
        select: { id: true, type: true, status: true, errorMessage: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const tasks: Promise<void>[] = [];

  for (const document of documents) {
    const latestJob = (type: JobType) => document.jobs.find((job) => job.type === type);
    const extraction = latestJob(JobType.EXTRACT_TEXT);
    const chunking = latestJob(JobType.CHUNK_DOCUMENT);
    const embedding = latestJob(JobType.EMBED_DOCUMENT);
    const analysis = latestJob(JobType.ANALYZE_DOCUMENT);
    if (!extraction || !chunking || !embedding) continue;

    const extractionAndChunkingComplete = extraction.status === JobStatus.COMPLETED
      && chunking.status === JobStatus.COMPLETED;

    if (!extractionAndChunkingComplete && (isActive(extraction.status) || isActive(chunking.status))) {
      const jobs = await Promise.all([
        resetDocumentJob(document.id, JobType.EXTRACT_TEXT),
        resetDocumentJob(document.id, JobType.CHUNK_DOCUMENT),
        resetDocumentJob(document.id, JobType.EMBED_DOCUMENT),
        resetDocumentJob(document.id, JobType.ANALYZE_DOCUMENT),
      ]);
      tasks.push(enqueueDocumentPipeline({
        documentId: document.id,
        extractionJobId: jobs[0].id,
        chunkJobId: jobs[1].id,
        embeddingJobId: jobs[2].id,
        analysisJobId: jobs[3].id,
      }));
      continue;
    }

    const shouldResumeEmbedding = embedding.status !== JobStatus.COMPLETED
      && (isActive(embedding.status)
        || (embedding.status === JobStatus.FAILED
          && isTransientEmbeddingFailure(embedding.errorMessage)));
    if (extractionAndChunkingComplete && shouldResumeEmbedding) {
      const embeddingJob = await resetDocumentJob(document.id, JobType.EMBED_DOCUMENT);
      const analysisJob = analysis?.status === JobStatus.COMPLETED
        ? null
        : await resetDocumentJob(document.id, JobType.ANALYZE_DOCUMENT);
      tasks.push(enqueueDocumentEmbedding({
        documentId: document.id,
        embeddingJobId: embeddingJob.id,
        analysisJobId: analysisJob?.id,
      }));
      continue;
    }

    if (embedding.status === JobStatus.COMPLETED && analysis && isActive(analysis.status)) {
      const analysisJob = await resetDocumentJob(document.id, JobType.ANALYZE_DOCUMENT);
      tasks.push(enqueueDocumentAnalysis({
        documentId: document.id,
        analysisJobId: analysisJob.id,
      }));
    }
  }

  return {
    scheduled: tasks.length,
    completion: Promise.allSettled(tasks).then(() => undefined),
  };
}
