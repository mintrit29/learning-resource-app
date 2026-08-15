import { after, NextResponse } from "next/server";
import { JobStatus, JobType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import {
  enqueueDocumentAnalysis,
  enqueueDocumentEmbedding,
  enqueueDocumentPipeline,
} from "@/lib/documents/document-processing-queue";
import { resetDocumentJob } from "@/lib/documents/processing-jobs";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const document = await db.document.findFirst({
    where: { id },
    select: {
      id: true,
      textContent: true,
      primaryTopic: true,
      difficulty: true,
      summary: true,
      _count: { select: { chunks: true } },
    },
  });
  if (!document) return NextResponse.json({ message: "Không tìm thấy tài liệu" }, { status: 404 });

  const activeJob = await db.analysisJob.findFirst({
    where: { documentId: id, status: { in: [JobStatus.PENDING, JobStatus.PROCESSING] } },
  });
  if (activeJob) return NextResponse.json({ message: "Tài liệu đang có tác vụ chạy" }, { status: 409 });

  const analysisComplete = Boolean(document.difficulty && document.summary);

  if (!document.textContent || document._count.chunks === 0) {
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
    });
    after(() => processing);
    return NextResponse.json({ message: "Đã chạy lại từ bước xử lý đầu tiên còn thiếu" }, { status: 202 });
  }

  const missing = await db.documentChunk.count({
    where: { documentId: id, embedding: null },
  });

  if (missing > 0) {
    const embeddingJob = await resetDocumentJob(id, JobType.EMBED_DOCUMENT);
    const analysisJob = analysisComplete ? null : await resetDocumentJob(id, JobType.ANALYZE_DOCUMENT);
    const processing = enqueueDocumentEmbedding({
      documentId: id,
      embeddingJobId: embeddingJob.id,
      analysisJobId: analysisJob?.id,
    });
    after(() => processing);
    return NextResponse.json({ message: "Đã tiếp tục embedding và các bước còn thiếu" }, { status: 202 });
  }

  if (!analysisComplete) {
    const job = await resetDocumentJob(id, JobType.ANALYZE_DOCUMENT);
    const processing = enqueueDocumentAnalysis({ documentId: id, analysisJobId: job.id });
    after(() => processing);
    return NextResponse.json({ message: "Embedding được giữ nguyên; chỉ chạy lại phân tích AI" }, { status: 202 });
  }

  return NextResponse.json({ message: "Tài liệu đã được xử lý đầy đủ" }, { status: 409 });
}
