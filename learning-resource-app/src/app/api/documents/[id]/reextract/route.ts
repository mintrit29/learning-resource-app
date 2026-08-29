import { access } from "node:fs/promises";
import { after, NextResponse } from "next/server";
import { JobStatus, JobType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { enqueueDocumentPipeline } from "@/lib/documents/document-processing-queue";
import { resetDocumentJob } from "@/lib/documents/processing-jobs";
import { resolveStoredUploadPath } from "@/lib/storage/local-storage";
import {
  DOCLING_MISSING_MESSAGE,
  isDoclingReady,
  isUploadWhisperReady,
  UPLOAD_WHISPER_MISSING_MESSAGE,
} from "@/lib/desktop/component-availability";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const document = await db.document.findFirst({
    where: { id },
    select: {
      id: true,
      fileType: true,
      filePath: true,
      textContent: true,
      _count: { select: { chunks: true } },
    },
  });
  if (!document) {
    return NextResponse.json({ message: "Không tìm thấy tài liệu" }, { status: 404 });
  }
  const isAudio = document.fileType === "AUDIO";
  if (document.fileType !== "XMIND" && (isAudio ? !await isUploadWhisperReady() : !await isDoclingReady())) {
    return NextResponse.json({
      message: isAudio ? UPLOAD_WHISPER_MISSING_MESSAGE : DOCLING_MISSING_MESSAGE,
      setupUrl: "/settings/components",
    }, { status: 503 });
  }
  const originalFilePath = resolveStoredUploadPath(document.filePath);
  if (!originalFilePath || !await access(originalFilePath).then(() => true).catch(() => false)) {
    return NextResponse.json({ message: "Không tìm thấy file gốc để trích xuất lại" }, { status: 409 });
  }

  const activeJob = await db.analysisJob.findFirst({
    where: { documentId: id, status: { in: [JobStatus.PENDING, JobStatus.PROCESSING] } },
    select: { id: true },
  });
  if (activeJob) {
    return NextResponse.json({ message: "Tài liệu đang có tác vụ chạy" }, { status: 409 });
  }

  const jobs = await Promise.all([
    resetDocumentJob(id, JobType.EXTRACT_TEXT),
    resetDocumentJob(id, JobType.CHUNK_DOCUMENT),
    resetDocumentJob(id, JobType.EMBED_DOCUMENT),
    resetDocumentJob(id, JobType.ANALYZE_DOCUMENT),
  ]);
  const processing = enqueueDocumentPipeline({
    documentId: id,
    extractionJobId: jobs[0].id,
    chunkJobId: jobs[1].id,
    embeddingJobId: jobs[2].id,
    analysisJobId: jobs[3].id,
    resetAnalysisAfterExtraction: true,
    preserveExistingOnExtractionFailure: Boolean(document.textContent && document._count.chunks > 0),
  });
  after(() => processing);

  return NextResponse.json({ message: `Đã bắt đầu trích xuất lại bằng ${document.fileType === "XMIND" ? "bộ đọc XMind" : isAudio ? "Whisper" : "Docling/OCR"}` }, { status: 202 });
}
