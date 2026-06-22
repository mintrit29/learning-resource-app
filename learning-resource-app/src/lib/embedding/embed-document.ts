import { DocumentStatus, JobStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { embedTexts, toPgVector } from "@/lib/embedding/client";

const EMBEDDING_BATCH_SIZE = 4;

type PendingChunk = {
  id: string;
  content: string;
};

export async function embedDocumentChunks(documentId: string, jobId: string) {
  try {
    const chunks = await db.$queryRawUnsafe<PendingChunk[]>(
      `SELECT "id", "content"
       FROM "DocumentChunk"
       WHERE "documentId" = $1 AND "embedding" IS NULL
       ORDER BY "chunkIndex" ASC`,
      documentId,
    );
    const totalChunkCount = await db.documentChunk.count({ where: { documentId } });
    if (totalChunkCount === 0) throw new Error("Tài liệu chưa có chunks để tạo embedding");

    await db.analysisJob.update({
      where: { id: jobId },
      data: { status: JobStatus.PROCESSING, progress: 1, startedAt: new Date() },
    });

    for (let offset = 0; offset < chunks.length; offset += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(offset, offset + EMBEDDING_BATCH_SIZE);
      const result = await embedTexts(batch.map((chunk) => chunk.content));

      await db.$transaction(
        result.embeddings.map((vector, index) =>
          db.$executeRawUnsafe(
            'UPDATE "DocumentChunk" SET "embedding" = $1::vector WHERE "id" = $2',
            toPgVector(vector),
            batch[index].id,
          ),
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
  }
}
