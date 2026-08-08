import { DocumentStatus, JobStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { embedTexts } from "@/lib/embedding/client";
import { resolveEmbeddingRequestBatchSize } from "@/lib/embedding/config";
import {
  getSqliteVectorStore,
  toSqliteVectorBlob,
} from "@/lib/vector/sqlite-vector-store";

const EMBEDDING_REQUEST_BATCH_SIZE = resolveEmbeddingRequestBatchSize();

type PendingChunk = {
  id: string;
  content: string;
};

export async function embedDocumentChunks(documentId: string, jobId: string) {
  try {
    const chunks: PendingChunk[] = await db.documentChunk.findMany({
      where: { documentId, embedding: null },
      select: { id: true, content: true },
      orderBy: { chunkIndex: "asc" },
    });
    const totalChunkCount = await db.documentChunk.count({ where: { documentId } });
    if (totalChunkCount === 0) throw new Error("Tài liệu chưa có chunks để tạo embedding");

    await db.analysisJob.update({
      where: { id: jobId },
      data: { status: JobStatus.PROCESSING, progress: 1, startedAt: new Date() },
    });

    for (
      let offset = 0;
      offset < chunks.length;
      offset += EMBEDDING_REQUEST_BATCH_SIZE
    ) {
      const batch = chunks.slice(offset, offset + EMBEDDING_REQUEST_BATCH_SIZE);
      const result = await embedTexts(batch.map((chunk) => chunk.content));
      const vectorStore = getSqliteVectorStore();

      result.embeddings.forEach((vector, index) => {
        vectorStore.upsertChunkEmbedding(batch[index].id, vector);
      });

      await db.$transaction(
        result.embeddings.map((vector, index) =>
          db.documentChunk.update({
            where: { id: batch[index].id },
            data: { embedding: toSqliteVectorBlob(vector) },
          }),
        ),
      );

      const alreadyEmbedded = totalChunkCount - chunks.length;
      const progress = Math.min(
        99,
        Math.round(((alreadyEmbedded + offset + batch.length) / totalChunkCount) * 100),
      );
      await db.analysisJob.update({ where: { id: jobId }, data: { progress } });
    }

    await Promise.all([
      db.analysisJob.update({
        where: { id: jobId },
        data: { status: JobStatus.COMPLETED, progress: 100, finishedAt: new Date() },
      }),
      db.document.update({
        where: { id: documentId },
        data: { status: DocumentStatus.READY, analysisReason: null },
      }),
    ]);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tạo embedding thất bại";
    await db.analysisJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.FAILED,
        errorMessage: message.slice(0, 500),
        finishedAt: new Date(),
      },
    });
    await db.document.update({
      where: { id: documentId },
      data: { analysisReason: `Embedding: ${message}`.slice(0, 500) },
    });
    return false;
  }
}
