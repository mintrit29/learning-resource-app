import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  DocumentStatus,
  FileType,
  JobStatus,
} from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { embedDocumentChunks } from "@/lib/embedding/embed-document";
import { chunkDocumentSections } from "@/lib/documents/chunk-text";
import {
  extractDocumentText,
  type SupportedExtension,
} from "@/lib/documents/extract-text";

type PipelineInput = {
  documentId: string;
  extractionJobId: string;
  chunkJobId: string;
  embeddingJobId: string;
};

const extensions: Record<FileType, SupportedExtension> = {
  [FileType.PDF]: "pdf",
  [FileType.PPTX]: "pptx",
  [FileType.DOCX]: "docx",
  [FileType.EPUB]: "epub",
};

async function failJob(jobId: string, message: string) {
  await db.analysisJob.update({
    where: { id: jobId },
    data: {
      status: JobStatus.FAILED,
      errorMessage: message.slice(0, 500),
      finishedAt: new Date(),
    },
  });
}

export async function processDocumentPipeline(input: PipelineInput) {
  let activeJobId = input.extractionJobId;
  let extractionCompleted = false;

  try {
    const document = await db.document.findUniqueOrThrow({
      where: { id: input.documentId },
      select: { id: true, filePath: true, fileType: true },
    });

    await Promise.all([
      db.document.update({
        where: { id: document.id },
        data: { status: DocumentStatus.EXTRACTING, analysisReason: null },
      }),
      db.analysisJob.update({
        where: { id: input.extractionJobId },
        data: { status: JobStatus.PROCESSING, progress: 10, startedAt: new Date() },
      }),
    ]);

    const absolutePath = path.resolve(
      /* turbopackIgnore: true */ process.cwd(),
      document.filePath,
    );
    const buffer = await readFile(absolutePath);
    const result = await extractDocumentText(buffer, extensions[document.fileType]);
    if (result.text.length < 20) {
      throw new Error("Không tìm thấy đủ nội dung dạng text trong tài liệu");
    }

    await Promise.all([
      db.document.update({
        where: { id: document.id },
        data: { textContent: result.text, status: DocumentStatus.EXTRACTED },
      }),
      db.analysisJob.update({
        where: { id: input.extractionJobId },
        data: { status: JobStatus.COMPLETED, progress: 100, finishedAt: new Date() },
      }),
    ]);
    extractionCompleted = true;

    activeJobId = input.chunkJobId;
    await db.analysisJob.update({
      where: { id: input.chunkJobId },
      data: { status: JobStatus.PROCESSING, progress: 20, startedAt: new Date() },
    });

    const chunks = chunkDocumentSections(result.sections);
    if (chunks.length === 0) throw new Error("Không thể chia nội dung thành chunks");

    await db.$transaction(async (transaction) => {
      await transaction.documentChunk.deleteMany({
        where: { documentId: document.id },
      });
      await transaction.documentChunk.createMany({
        data: chunks.map((chunk) => ({
          documentId: document.id,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          pageNumber: chunk.pageNumber,
          sourceLabel: chunk.sourceLabel,
        })),
      });
      await transaction.analysisJob.update({
        where: { id: input.chunkJobId },
        data: { status: JobStatus.COMPLETED, progress: 100, finishedAt: new Date() },
      });
    });

    await embedDocumentChunks(document.id, input.embeddingJobId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Xử lý tài liệu thất bại";
    await failJob(activeJobId, message);

    if (!extractionCompleted) {
      await Promise.all([
        db.document.update({
          where: { id: input.documentId },
          data: { status: DocumentStatus.FAILED, analysisReason: message.slice(0, 500) },
        }),
        db.analysisJob.update({
          where: { id: input.chunkJobId },
          data: {
            status: JobStatus.FAILED,
            errorMessage: "Không thể chunk vì bước trích xuất thất bại",
            finishedAt: new Date(),
          },
        }),
        db.analysisJob.update({
          where: { id: input.embeddingJobId },
          data: {
            status: JobStatus.FAILED,
            errorMessage: "Không thể embed vì bước trích xuất thất bại",
            finishedAt: new Date(),
          },
        }),
      ]);
    } else if (activeJobId === input.chunkJobId) {
      await db.analysisJob.update({
        where: { id: input.embeddingJobId },
        data: {
          status: JobStatus.FAILED,
          errorMessage: "Không thể embed vì bước chunking thất bại",
          finishedAt: new Date(),
        },
      });
    }
  }
}
