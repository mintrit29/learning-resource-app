import { after, NextResponse } from "next/server";
import { auth } from "@/auth";
import { JobStatus, JobType } from "@/generated/prisma/enums";
import { analyzeDocument } from "@/lib/ai/analyze-document";
import { db } from "@/lib/db";
import { processDocumentPipeline } from "@/lib/documents/process-document";
import { embedDocumentChunks } from "@/lib/embedding/embed-document";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });

  const { id } = await params;
  const document = await db.document.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      textContent: true,
      primaryTopic: true,
      difficulty: true,
      summary: true,
      subtopics: true,
      keywords: true,
      _count: { select: { chunks: true } },
    },
  });
  if (!document) return NextResponse.json({ message: "Không tìm thấy tài liệu" }, { status: 404 });

  const activeJob = await db.analysisJob.findFirst({
    where: { documentId: id, status: { in: [JobStatus.PENDING, JobStatus.PROCESSING] } },
  });
  if (activeJob) return NextResponse.json({ message: "Tài liệu đang có tác vụ chạy" }, { status: 409 });

  const analysisComplete = Boolean(
    document.primaryTopic && document.difficulty && document.summary &&
    document.subtopics.length && document.keywords.length,
  );

  if (!document.textContent || document._count.chunks === 0) {
    const jobs = await db.$transaction([
      db.analysisJob.create({ data: { documentId: id, type: JobType.EXTRACT_TEXT } }),
      db.analysisJob.create({ data: { documentId: id, type: JobType.CHUNK_DOCUMENT } }),
      db.analysisJob.create({ data: { documentId: id, type: JobType.EMBED_DOCUMENT } }),
      db.analysisJob.create({ data: { documentId: id, type: JobType.ANALYZE_DOCUMENT } }),
    ]);
    after(() => processDocumentPipeline({
      documentId: id,
      extractionJobId: jobs[0].id,
      chunkJobId: jobs[1].id,
      embeddingJobId: jobs[2].id,
      analysisJobId: jobs[3].id,
    }));
    return NextResponse.json({ message: "Đã chạy lại từ bước xử lý đầu tiên còn thiếu" }, { status: 202 });
  }

  const [{ missing }] = await db.$queryRawUnsafe<Array<{ missing: bigint }>>(
    `SELECT COUNT(*) AS "missing" FROM "DocumentChunk" WHERE "documentId" = $1 AND "embedding" IS NULL`,
    id,
  );

  if (Number(missing) > 0) {
    const embeddingJob = await db.analysisJob.create({
      data: { documentId: id, type: JobType.EMBED_DOCUMENT },
    });
    const analysisJob = analysisComplete ? null : await db.analysisJob.create({
      data: { documentId: id, type: JobType.ANALYZE_DOCUMENT },
    });
    after(async () => {
      const embedded = await embedDocumentChunks(id, embeddingJob.id);
      if (embedded && analysisJob) await analyzeDocument(id, analysisJob.id);
      if (!embedded && analysisJob) {
        await db.analysisJob.update({
          where: { id: analysisJob.id },
          data: {
            status: JobStatus.FAILED,
            errorMessage: "Không thể phân tích vì bước embedding thất bại",
            finishedAt: new Date(),
          },
        });
      }
    });
    return NextResponse.json({ message: "Đã tiếp tục embedding và các bước còn thiếu" }, { status: 202 });
  }

  if (!analysisComplete) {
    const job = await db.analysisJob.create({ data: { documentId: id, type: JobType.ANALYZE_DOCUMENT } });
    after(() => analyzeDocument(id, job.id));
    return NextResponse.json({ message: "Embedding được giữ nguyên; chỉ chạy lại phân tích AI" }, { status: 202 });
  }

  return NextResponse.json({ message: "Tài liệu đã được xử lý đầy đủ" }, { status: 409 });
}
