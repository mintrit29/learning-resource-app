import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

function textFileName(originalFileName: string) {
  const baseName = originalFileName.replace(/\.[^.]+$/, "") || "document";
  return `${baseName}-extracted.txt`;
}

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
    select: { originalFileName: true, textContent: true },
  });
  if (!document) {
    return NextResponse.json({ message: "Không tìm thấy tài liệu" }, { status: 404 });
  }

  if (!document.textContent) {
    return NextResponse.json({ message: "Tài liệu chưa có nội dung trích xuất" }, { status: 404 });
  }

  const body = `# Extracted text from: ${document.originalFileName}\n\n${document.textContent}`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(textFileName(document.originalFileName))}`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
