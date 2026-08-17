import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function textFileName(originalFileName: string) {
  const baseName = originalFileName.replace(/\.[^.]+$/, "") || "document";
  return `${baseName}-extracted.txt`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const document = await db.document.findFirst({
    where: { id },
    select: { originalFileName: true, textContent: true },
  });
  if (!document) {
    return NextResponse.json({ message: "Không tìm thấy tài liệu" }, { status: 404 });
  }

  if (!document.textContent) {
    return NextResponse.json({ message: "Tài liệu chưa có nội dung trích xuất" }, { status: 404 });
  }

  const inline = new URL(request.url).searchParams.get("inline") === "1";
  const body = inline
    ? document.textContent
    : `# Extracted text from: ${document.originalFileName}\n\n${document.textContent}`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...(inline ? {} : {
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(textFileName(document.originalFileName))}`,
      }),
      "Cache-Control": inline ? "private, no-store" : "private, max-age=300",
    },
  });
}
