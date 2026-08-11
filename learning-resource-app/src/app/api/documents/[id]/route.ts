import { unlink } from "node:fs/promises";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Difficulty, DocumentTagSource } from "@/generated/prisma/enums";
import { documentAnalysisEditSchema } from "@/lib/ai/analysis-schema";
import { db } from "@/lib/db";
import { resolveStoredUploadPath } from "@/lib/storage/local-storage";
import { replaceDocumentTopic } from "@/lib/taxonomy/topic-assignment";
import { getSqliteVectorStore } from "@/lib/vector/sqlite-vector-store";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });

  const parsed = documentAnalysisEditSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 },
    );
  }

  const { id } = await params;
  const document = await db.document.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
  if (!document) return NextResponse.json({ message: "Không tìm thấy tài liệu" }, { status: 404 });

  const result = parsed.data;
  let topic: Awaited<ReturnType<typeof replaceDocumentTopic>>;
  try {
    topic = await replaceDocumentTopic({
      documentId: document.id,
      userId: session.user.id,
      topicId: result.topicId,
      source: DocumentTagSource.USER,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể cập nhật môn học" },
      { status: 400 },
    );
  }
  await db.document.update({
    where: { id: document.id },
    data: {
      primaryTopic: topic?.name ?? null,
      difficulty: result.difficulty as Difficulty,
      language: result.language,
      summary: result.summary,
      analysisReason: result.reason,
    },
  });
  return NextResponse.json({ message: "Đã cập nhật kết quả phân loại" });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });
  }

  const { id } = await params;
  const document = await db.document.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, filePath: true, chunks: { select: { id: true } } },
  });

  if (!document) {
    return NextResponse.json({ message: "Không tìm thấy tài liệu" }, { status: 404 });
  }

  const absoluteFilePath = resolveStoredUploadPath(document.filePath, session.user.id);
  if (!absoluteFilePath) {
    return NextResponse.json(
      { message: "Đường dẫn file không hợp lệ" },
      { status: 400 },
    );
  }

  await unlink(absoluteFilePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
  await db.document.delete({ where: { id: document.id } });
  getSqliteVectorStore().deleteChunkEmbeddings(document.chunks.map((chunk) => chunk.id));

  return NextResponse.json({ message: "Đã xóa tài liệu" });
}
