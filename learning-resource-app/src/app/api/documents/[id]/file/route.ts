import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveStoredUploadPath } from "@/lib/storage/local-storage";

const contentTypes: Record<string, string> = {
  PDF: "application/pdf",
  PPTX: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  EPUB: "application/epub+zip",
  IMAGE: "application/octet-stream",
  AUDIO: "application/octet-stream",
  XMIND: "application/vnd.xmind.workbook",
};

const extensionContentTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const document = await db.document.findFirst({
    where: { id },
    select: { filePath: true, fileType: true, originalFileName: true },
  });
  if (!document) {
    return NextResponse.json({ message: "Không tìm thấy tài liệu" }, { status: 404 });
  }

  const absolutePath = resolveStoredUploadPath(document.filePath);
  if (!absolutePath) {
    return NextResponse.json({ message: "Đường dẫn file không hợp lệ" }, { status: 400 });
  }

  const file = await readFile(absolutePath).catch(() => null);
  if (!file) {
    return NextResponse.json({ message: "File gốc không còn tồn tại" }, { status: 404 });
  }

  const url = new URL(request.url);
  const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";

  return new Response(file, {
    headers: {
      "Content-Type": extensionContentTypes[document.originalFileName.split(".").pop()?.toLowerCase() ?? ""] ?? contentTypes[document.fileType],
      "Content-Length": String(file.byteLength),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(document.originalFileName)}`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
