import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { embedTexts } from "@/lib/embedding/client";
import { findExactTagOrAlias } from "@/lib/taxonomy/canonical-tags";
import { normalizeTagName } from "@/lib/taxonomy/normalize-tag";
import { toSqliteVectorBlob } from "@/lib/vector/sqlite-vector-store";

const updateSchema = z.object({ name: z.string().trim().min(2).max(100), description: z.string().trim().max(500).optional().default("") });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });
  const { id } = await params;
  const current = await db.tag.findFirst({ where: { id, createdByUserId: session.user.id } });
  if (!current) return NextResponse.json({ message: "Không tìm thấy môn học" }, { status: 404 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }, { status: 400 });
  const duplicate = await findExactTagOrAlias(session.user.id, parsed.data.name);
  if (duplicate && duplicate.id !== current.id) return NextResponse.json({ message: "Tên môn học hoặc tên gọi khác này đã tồn tại" }, { status: 409 });

  try {
    const text = parsed.data.description ? `${parsed.data.name}: ${parsed.data.description}` : parsed.data.name;
    const embedded = await embedTexts([text]);
    const tag = await db.$transaction(async (transaction) => {
      const updated = await transaction.tag.update({
        where: { id },
        data: {
          name: parsed.data.name,
          normalizedName: normalizeTagName(parsed.data.name),
          description: parsed.data.description || null,
          isClassificationEnabled: true,
          embedding: toSqliteVectorBlob(embedded.embeddings[0]),
        },
      });
      if (current.name !== updated.name) {
        await transaction.document.updateMany({
          where: { userId: session.user.id, primaryTopic: current.name },
          data: { primaryTopic: updated.name },
        });
      }
      return updated;
    });
    return NextResponse.json({ tag });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Không thể cập nhật môn học" }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });
  const { id } = await params;
  const topic = await db.tag.findFirst({
    where: { id, createdByUserId: session.user.id },
    select: { id: true, name: true },
  });
  if (!topic) return NextResponse.json({ message: "Không tìm thấy môn học" }, { status: 404 });

  await db.$transaction(async (transaction) => {
    const affectedDocuments = await transaction.document.findMany({
      where: {
        userId: session.user.id,
        OR: [
          { primaryTopic: topic.name },
          { tags: { some: { tagId: topic.id } } },
        ],
      },
      select: { id: true },
    });
    const documentIds = affectedDocuments.map((document) => document.id);
    await transaction.document.updateMany({
      where: { id: { in: documentIds }, userId: session.user.id },
      data: {
        primaryTopic: null,
        analysisReason: "Môn học đã bị xóa. Tài liệu đang chờ người dùng phân loại lại.",
      },
    });
    await transaction.documentTag.deleteMany({
      where: { documentId: { in: documentIds } },
    });
    await transaction.tag.delete({ where: { id: topic.id } });
  });
  return NextResponse.json({ message: "Đã xóa môn học; tài liệu liên quan được chuyển sang Chưa phân loại" });
}
