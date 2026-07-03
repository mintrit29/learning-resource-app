import { after, NextResponse } from "next/server";
import { auth } from "@/auth";
import { JobStatus, JobType } from "@/generated/prisma/enums";
import { analyzeDocument } from "@/lib/ai/analyze-document";
import { db } from "@/lib/db";
import { resetDocumentJob } from "@/lib/documents/processing-jobs";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });
  }

  const { id } = await params;
  const document = await db.document.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, textContent: true },
  });
  if (!document) {
    return NextResponse.json({ message: "Không tìm thấy tài liệu" }, { status: 404 });
  }
  if (!document.textContent) {
    return NextResponse.json({ message: "Tài liệu chưa có nội dung để phân tích AI" }, { status: 409 });
  }

  const activeJob = await db.analysisJob.findFirst({
    where: { documentId: id, status: { in: [JobStatus.PENDING, JobStatus.PROCESSING] } },
  });
  if (activeJob) {
    return NextResponse.json({ message: "Tài liệu đang có tác vụ chạy" }, { status: 409 });
  }

  const job = await resetDocumentJob(id, JobType.ANALYZE_DOCUMENT);
  after(() => analyzeDocument(id, job.id));

  return NextResponse.json({ message: "Đã chạy lại phân tích AI" }, { status: 202 });
}
