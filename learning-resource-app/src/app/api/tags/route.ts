import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { embedTexts, toPgVector } from "@/lib/embedding/client";
import { findExactTagOrAlias } from "@/lib/taxonomy/canonical-tags";
import { normalizeTagName } from "@/lib/taxonomy/normalize-tag";

const tagSchema = z.object({ name: z.string().trim().min(2).max(100), description: z.string().trim().max(500).optional().default("") });

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });
  const tags = await db.tag.findMany({ where: { createdByUserId: session.user.id }, select: { id: true, name: true, normalizedName: true, description: true, createdAt: true, _count: { select: { aliases: true, documents: true } } }, orderBy: { name: "asc" } });
  return NextResponse.json({ tags });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });
  const parsed = tagSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }, { status: 400 });
  if (await findExactTagOrAlias(session.user.id, parsed.data.name)) return NextResponse.json({ message: "Tên tag hoặc alias này đã tồn tại" }, { status: 409 });

  try {
    const text = parsed.data.description ? `${parsed.data.name}: ${parsed.data.description}` : parsed.data.name;
    const embedded = await embedTexts([text]);
    const tag = await db.$transaction(async (tx) => {
      const created = await tx.tag.create({ data: { name: parsed.data.name, normalizedName: normalizeTagName(parsed.data.name), description: parsed.data.description || null, createdByUserId: session.user.id } });
      await tx.$executeRawUnsafe('UPDATE "Tag" SET "embedding" = $1::vector WHERE "id" = $2', toPgVector(embedded.embeddings[0]), created.id);
      return created;
    });
    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Không thể tạo tag" }, { status: 503 });
  }
}
