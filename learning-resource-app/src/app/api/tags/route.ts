import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { embedTexts } from "@/lib/embedding/client";
import { findExactTagOrAlias } from "@/lib/taxonomy/canonical-tags";
import { normalizeTagName } from "@/lib/taxonomy/normalize-tag";
import { toSqliteVectorBlob } from "@/lib/vector/sqlite-vector-store";
import { ensureCurriculumTopics } from "@/lib/taxonomy/curriculum-topics";

const tagSchema = z.object({ name: z.string().trim().min(2).max(100), description: z.string().trim().max(500).optional().default("") });

export async function GET() {
  await ensureCurriculumTopics();
  const tags = await db.tag.findMany({ select: { id: true, name: true, normalizedName: true, description: true, isClassificationEnabled: true, createdAt: true, _count: { select: { aliases: true, documents: true } } }, orderBy: { name: "asc" } });
  return NextResponse.json({ tags });
}

export async function POST(request: Request) {
  const parsed = tagSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }, { status: 400 });
  if (await findExactTagOrAlias(parsed.data.name)) return NextResponse.json({ message: "Tên môn học hoặc tên gọi khác này đã tồn tại" }, { status: 409 });

  try {
    const text = parsed.data.description ? `${parsed.data.name}: ${parsed.data.description}` : parsed.data.name;
    const embedded = await embedTexts([text]);
    const tag = await db.tag.create({
      data: {
        name: parsed.data.name,
        normalizedName: normalizeTagName(parsed.data.name),
        description: parsed.data.description || null,
        isClassificationEnabled: true,
        embedding: toSqliteVectorBlob(embedded.embeddings[0]),
      },
    });
    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Không thể tạo môn học" }, { status: 503 });
  }
}
