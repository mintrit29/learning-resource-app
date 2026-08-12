import { access } from "node:fs/promises";
import { after, NextResponse } from "next/server";
import { auth } from "@/auth";
import { JobStatus, JobType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { enqueueDocumentPipeline } from "@/lib/documents/document-processing-queue";
import { resetDocumentJob } from "@/lib/documents/processing-jobs";
import { resolveStoredUploadPath } from "@/lib/storage/local-storage";
import { DOCLING_MISSING_MESSAGE, isDoclingReady } from "@/lib/desktop/component-availability";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });
  }
  if (!await isDoclingReady()) {
    return NextResponse.json({ message: DOCLING_MISSING_MESSAGE, setupUrl: "/settings/components" }, { status: 503 });
  }

  const { id } = await params;
  const document = await db.document.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      filePath: true,
      textContent: true,
      _count: { select: { chunks: true } },
    },
  });
  if (!document) {
    return NextResponse.json({ message: "Không tìm thấy tài liệu" }, { status: 404 });
  }
  const originalFilePath = resolveStoredUploadPath(document.filePath, session.user.id);
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

  return NextResponse.json({ message: "Đã bắt đầu trích xuất lại bằng Docling" }, { status: 202 });
}
