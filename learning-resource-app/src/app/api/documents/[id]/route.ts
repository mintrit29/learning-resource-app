import { unlink } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Difficulty } from "@/generated/prisma/enums";
import { documentAnalysisSchema } from "@/lib/ai/analysis-schema";
import { db } from "@/lib/db";

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
  await db.document.update({
    where: { id: document.id },
    data: {
      primaryTopic: result.topic,
      difficulty: result.difficulty as Difficulty,
      summary: result.summary,
      subtopics: [...new Set(result.subtopics)],
      keywords: [...new Set(result.keywords)],
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
    select: { id: true, filePath: true },
  });

  if (!document) {
    return NextResponse.json({ message: "Không tìm thấy tài liệu" }, { status: 404 });
  }

  const storageRoot = path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    "storage",
    "uploads",
  );
  const absoluteFilePath = path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    document.filePath,
  );
  const isInsideStorage = absoluteFilePath.startsWith(`${storageRoot}${path.sep}`);

  if (!isInsideStorage) {
    return NextResponse.json(
      { message: "Đường dẫn file không hợp lệ" },
      { status: 400 },
    );
  }

  await unlink(absoluteFilePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
  await db.document.delete({ where: { id: document.id } });

  return NextResponse.json({ message: "Đã xóa tài liệu" });
}
