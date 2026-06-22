import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { embedTexts, toPgVector } from "@/lib/embedding/client";
import { findExactTagOrAlias } from "@/lib/taxonomy/canonical-tags";
import { normalizeTagName } from "@/lib/taxonomy/normalize-tag";

const updateSchema = z.object({ name: z.string().trim().min(2).max(100), description: z.string().trim().max(500).optional().default("") });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });
  const { id } = await params;
  const current = await db.tag.findFirst({ where: { id, createdByUserId: session.user.id } });
  if (!current) return NextResponse.json({ message: "Không tìm thấy tag" }, { status: 404 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }, { status: 400 });
  const duplicate = await findExactTagOrAlias(session.user.id, parsed.data.name);
  if (duplicate && duplicate.id !== current.id) return NextResponse.json({ message: "Tên tag hoặc alias này đã tồn tại" }, { status: 409 });

  try {
    const text = parsed.data.description ? `${parsed.data.name}: ${parsed.data.description}` : parsed.data.name;
    const embedded = await embedTexts([text]);
    const tag = await db.$transaction(async (tx) => {
      const updated = await tx.tag.update({ where: { id }, data: { name: parsed.data.name, normalizedName: normalizeTagName(parsed.data.name), description: parsed.data.description || null } });
      await tx.$executeRawUnsafe('UPDATE "Tag" SET "embedding" = $1::vector WHERE "id" = $2', toPgVector(embedded.embeddings[0]), id);
      return updated;
    });
    return NextResponse.json({ tag });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Không thể cập nhật tag" }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });
  const { id } = await params;
  const result = await db.tag.deleteMany({ where: { id, createdByUserId: session.user.id } });
  if (!result.count) return NextResponse.json({ message: "Không tìm thấy tag" }, { status: 404 });
  return NextResponse.json({ message: "Đã xóa canonical tag" });
}
