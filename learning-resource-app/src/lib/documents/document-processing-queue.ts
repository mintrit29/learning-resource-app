import {
  processDocumentPipeline,
  type PipelineInput,
} from "@/lib/documents/process-document";
import {
  createSequentialTaskQueue,
  type SequentialTaskQueue,
} from "@/lib/documents/sequential-task-queue";

const globalForDocumentQueue = globalThis as typeof globalThis & {
  scholarFlowDocumentQueue?: SequentialTaskQueue<PipelineInput>;
};

const documentQueue = globalForDocumentQueue.scholarFlowDocumentQueue
  ?? createSequentialTaskQueue(processDocumentPipeline);
globalForDocumentQueue.scholarFlowDocumentQueue = documentQueue;

export function enqueueDocumentPipeline(input: PipelineInput) {
  return documentQueue.enqueue(input.documentId, input);
}

export function getDocumentQueuePendingCount() {
  return documentQueue.pendingCount();
}
