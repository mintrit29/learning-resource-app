import { JobStatus } from "@/generated/prisma/enums";
import { analyzeDocument } from "@/lib/ai/analyze-document";
import { db } from "@/lib/db";
import {
  processDocumentPipeline,
  type PipelineInput,
} from "@/lib/documents/process-document";
import { embedDocumentChunks } from "@/lib/embedding/embed-document";
import {
  createSequentialTaskQueue,
  type SequentialTaskQueue,
} from "@/lib/documents/sequential-task-queue";

type QueuedDocumentTask = () => Promise<void>;

const processWithDocumentQueue = process as NodeJS.Process & {
  scholarFlowDocumentQueue?: SequentialTaskQueue<QueuedDocumentTask>;
};

const documentQueue = processWithDocumentQueue.scholarFlowDocumentQueue
  ?? createSequentialTaskQueue((task) => task());
processWithDocumentQueue.scholarFlowDocumentQueue = documentQueue;

export function enqueueDocumentPipeline(input: PipelineInput) {
  return documentQueue.enqueue(input.documentId, () => processDocumentPipeline(input));
}

async function failAnalysisJob(jobId: string) {
  await db.analysisJob.update({
    where: { id: jobId },
    data: {
      status: JobStatus.FAILED,
      errorMessage: "Không thể phân tích vì bước embedding thất bại",
      finishedAt: new Date(),
    },
  });
}

export function enqueueDocumentEmbedding(input: {
  documentId: string;
  embeddingJobId: string;
  analysisJobId?: string | null;
}) {
  return documentQueue.enqueue(input.documentId, async () => {
    const embedded = await embedDocumentChunks(input.documentId, input.embeddingJobId);
    if (embedded && input.analysisJobId) {
      await analyzeDocument(input.documentId, input.analysisJobId);
    } else if (!embedded && input.analysisJobId) {
      await failAnalysisJob(input.analysisJobId);
    }
  });
}

export function enqueueDocumentAnalysis(input: {
  documentId: string;
  analysisJobId: string;
}) {
  return documentQueue.enqueue(input.documentId, () => (
    analyzeDocument(input.documentId, input.analysisJobId).then(() => undefined)
  ));
}

export function getDocumentQueuePendingCount() {
  return documentQueue.pendingCount();
}
