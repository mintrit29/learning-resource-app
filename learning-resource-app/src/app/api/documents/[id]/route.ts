import { unlink } from "node:fs/promises";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Difficulty } from "@/generated/prisma/enums";
import { documentAnalysisSchema } from "@/lib/ai/analysis-schema";
import { db } from "@/lib/db";
import { resolveStoredUploadPath } from "@/lib/storage/local-storage";
import { canonicalizePrimaryTopic } from "@/lib/taxonomy/canonical-topic";
import { syncDocumentTags } from "@/lib/taxonomy/sync-document-tags";
import { getSqliteVectorStore } from "@/lib/vector/sqlite-vector-store";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });

  const parsed = documentAnalysisSchema.safeParse(await request.json().catch(() => null));
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
  const canonicalTopic = await canonicalizePrimaryTopic(session.user.id, result.topic, result.topicAliases);
  await syncDocumentTags(document.id, session.user.id, [canonicalTopic]);
  await db.document.update({
    where: { id: document.id },
    data: {
      primaryTopic: canonicalTopic,
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
