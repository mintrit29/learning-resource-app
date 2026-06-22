import { unlink } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

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
