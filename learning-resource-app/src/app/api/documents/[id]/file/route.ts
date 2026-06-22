import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const contentTypes: Record<string, string> = {
  PDF: "application/pdf",
  PPTX: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  EPUB: "application/epub+zip",
};

export async function GET(
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
    select: { filePath: true, fileType: true, originalFileName: true },
  });
  if (!document) {
    return NextResponse.json({ message: "Không tìm thấy tài liệu" }, { status: 404 });
  }

  const storageRoot = path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    "storage",
    "uploads",
  );
  const absolutePath = path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    document.filePath,
  );
  if (!absolutePath.startsWith(`${storageRoot}${path.sep}`)) {
    return NextResponse.json({ message: "Đường dẫn file không hợp lệ" }, { status: 400 });
  }

  const file = await readFile(absolutePath).catch(() => null);
  if (!file) {
    return NextResponse.json({ message: "File gốc không còn tồn tại" }, { status: 404 });
  }

  return new Response(file, {
    headers: {
      "Content-Type": contentTypes[document.fileType],
      "Content-Length": String(file.byteLength),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(document.originalFileName)}`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
