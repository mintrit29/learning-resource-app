import { after, NextResponse } from "next/server";
import { auth } from "@/auth";
import { JobStatus, JobType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { processDocumentPipeline } from "@/lib/documents/process-document";
import { embedDocumentChunks } from "@/lib/embedding/embed-document";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });
  const { id } = await params;
  const document = await db.document.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
  if (!document) return NextResponse.json({ message: "Không tìm thấy tài liệu" }, { status: 404 });

  const activeJob = await db.analysisJob.findFirst({ where: { documentId: id, status: { in: [JobStatus.PENDING, JobStatus.PROCESSING] } } });
  if (activeJob) return NextResponse.json({ message: "Tài liệu đang có tác vụ chạy" }, { status: 409 });

  const body = await request.json().catch(() => null) as { jobType?: JobType } | null;
  if (!body?.jobType || !Object.values(JobType).includes(body.jobType)) return NextResponse.json({ message: "Loại tác vụ không hợp lệ" }, { status: 400 });

  if (body.jobType === JobType.EMBED_DOCUMENT) {
    const job = await db.analysisJob.create({ data: { documentId: id, type: JobType.EMBED_DOCUMENT } });
    after(() => embedDocumentChunks(id, job.id));
    return NextResponse.json({ message: "Đã xếp lại tác vụ embedding" }, { status: 202 });
  }

  if (body.jobType === JobType.ANALYZE_DOCUMENT) {
    return NextResponse.json({ message: "Phân tích AI chưa được triển khai" }, { status: 409 });
  }

  const jobs = await db.$transaction([
    db.analysisJob.create({ data: { documentId: id, type: JobType.EXTRACT_TEXT } }),
    db.analysisJob.create({ data: { documentId: id, type: JobType.CHUNK_DOCUMENT } }),
    db.analysisJob.create({ data: { documentId: id, type: JobType.EMBED_DOCUMENT } }),
  ]);
  after(() => processDocumentPipeline({ documentId: id, extractionJobId: jobs[0].id, chunkJobId: jobs[1].id, embeddingJobId: jobs[2].id }));
  return NextResponse.json({ message: "Đã chạy lại pipeline xử lý tài liệu" }, { status: 202 });
}
