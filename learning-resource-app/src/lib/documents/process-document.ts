import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  DocumentStatus,
  FileType,
  JobStatus,
} from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { analyzeDocument } from "@/lib/ai/analyze-document";
import { embedDocumentChunks } from "@/lib/embedding/embed-document";
import { chunkDocumentSections } from "@/lib/documents/chunk-text";
import {
  extractDocumentText,
  type SupportedExtension,
} from "@/lib/documents/extract-text";
import { resolveStoredUploadPath } from "@/lib/storage/local-storage";
import { getSqliteVectorStore } from "@/lib/vector/sqlite-vector-store";
import { toUserFacingError } from "@/lib/user-facing-error";

export type PipelineInput = {
  documentId: string;
  extractionJobId: string;
  chunkJobId: string;
  embeddingJobId: string;
  analysisJobId?: string;
  resetAnalysisAfterExtraction?: boolean;
  preserveExistingOnExtractionFailure?: boolean;
};

const extensions: Partial<Record<FileType, SupportedExtension>> = {
  [FileType.PDF]: "pdf",
  [FileType.PPTX]: "pptx",
  [FileType.DOCX]: "docx",
  [FileType.EPUB]: "epub",
  [FileType.XMIND]: "xmind",
};

function extensionForDocument(fileType: FileType, originalFileName: string): SupportedExtension {
  const fixed = extensions[fileType];
  if (fixed) return fixed;
  const extension = path.extname(originalFileName).slice(1).toLowerCase();
  const allowed = fileType === FileType.IMAGE
    ? ["png", "jpg", "jpeg", "webp"]
    : ["mp3", "wav", "m4a"];
  if (!allowed.includes(extension)) throw new Error("Định dạng file gốc không hợp lệ");
  return extension as SupportedExtension;
}

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
      select: { id: true, filePath: true, fileType: true, originalFileName: true },
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

    const absolutePath = resolveStoredUploadPath(document.filePath);
    if (!absolutePath) throw new Error("Invalid document file path");
    const buffer = await readFile(absolutePath);
    const extension = extensionForDocument(document.fileType, document.originalFileName);
    const result = await extractDocumentText(buffer, extension);
    const minimumTextLength = document.fileType === FileType.IMAGE ? 4 : 20;
    if (result.text.length < minimumTextLength) {
      if (document.fileType === FileType.PDF && (result.pageCount ?? 0) > 0) {
        throw new Error(
          "Tài liệu có vẻ là PDF scan/ảnh nhưng OCR không đọc được đủ nội dung. Hãy thử bản scan rõ hơn.",
        );
      }
      if (document.fileType === FileType.IMAGE) {
        throw new Error("Không nhận dạng được chữ trong ảnh mind map. Hãy thử ảnh rõ hoặc có độ phân giải cao hơn.");
      }
      if (document.fileType === FileType.AUDIO) {
        throw new Error("Không nhận dạng được đủ lời nói trong file âm thanh.");
      }
      throw new Error("Không tìm thấy đủ nội dung dạng text trong tài liệu");
    }

    await Promise.all([
      db.$transaction(async (transaction) => {
        if (input.resetAnalysisAfterExtraction) {
          await transaction.documentTag.deleteMany({ where: { documentId: document.id } });
        }
        await transaction.document.update({
          where: { id: document.id },
          data: {
            textContent: result.text,
            status: DocumentStatus.EXTRACTED,
            ...(input.resetAnalysisAfterExtraction ? {
              primaryTopic: null,
              difficulty: null,
              language: null,
              summary: null,
              analysisReason: null,
            } : {}),
          },
        });
      }),
      db.analysisJob.update({
        where: { id: input.extractionJobId },
        data: { status: JobStatus.COMPLETED, progress: 100, finishedAt: new Date(), errorMessage: result.warnings?.length ? `Lưu ý (${result.warnings.length}): ${result.warnings.join("; ").slice(0, 1500)}` : null },
      }),
    ]);
    extractionCompleted = true;

    activeJobId = input.chunkJobId;
    await db.analysisJob.update({
      where: { id: input.chunkJobId },
      data: { status: JobStatus.PROCESSING, progress: 20, startedAt: new Date() },
    });

    const chunks = chunkDocumentSections(result.sections);
    const previousChunks = await db.documentChunk.findMany({
      where: { documentId: document.id },
      select: { id: true },
    });
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

    getSqliteVectorStore().deleteChunkEmbeddings(previousChunks.map((chunk) => chunk.id));
    const embedded = await embedDocumentChunks(document.id, input.embeddingJobId);
    if (embedded && input.analysisJobId) {
      await analyzeDocument(document.id, input.analysisJobId);
    } else if (!embedded && input.analysisJobId) {
      await failJob(input.analysisJobId, "Không thể phân tích vì bước embedding thất bại");
    }
  } catch (error) {
    console.error(`[document-processing] document=${input.documentId} job=${activeJobId}`, error);
    const message = toUserFacingError(
      error,
      "Không thể xử lý tài liệu. Hãy kiểm tra file rồi thử lại.",
    );
    await failJob(activeJobId, message);

    if (!extractionCompleted) {
      await Promise.all([
        db.document.update({
          where: { id: input.documentId },
          data: {
            status: input.preserveExistingOnExtractionFailure
              ? DocumentStatus.READY
              : DocumentStatus.FAILED,
            analysisReason: `${input.preserveExistingOnExtractionFailure ? "Trích xuất lại" : "Trích xuất"}: ${message}`.slice(0, 500),
          },
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
      if (input.analysisJobId) {
        await failJob(input.analysisJobId, "Không thể phân tích vì bước trích xuất thất bại");
      }
    } else if (activeJobId === input.chunkJobId) {
      await db.analysisJob.update({
        where: { id: input.embeddingJobId },
        data: {
          status: JobStatus.FAILED,
          errorMessage: "Không thể embed vì bước chunking thất bại",
          finishedAt: new Date(),
        },
      });
      if (input.analysisJobId) {
        await failJob(input.analysisJobId, "Không thể phân tích vì bước chunking thất bại");
      }
    }
  }
}
