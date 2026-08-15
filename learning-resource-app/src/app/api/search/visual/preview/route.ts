import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { renderDocumentPreview, type PreviewFileType } from "@/lib/documents/render-document-preview";
import { createVisualPreviewSession, getVisualPreviewSession, removeVisualPreviewSession } from "@/lib/search/visual-preview-sessions";

export const runtime = "nodejs";

const MAX_PREVIEW_BYTES = 40 * 1024 * 1024;
const PREVIEW_TYPES = new Map<string, PreviewFileType>([
  [".docx", "DOCX"],
  [".pptx", "PPTX"],
  [".epub", "EPUB"],
]);
const pageSchema = z.object({
  sessionId: z.string().uuid(),
  item: z.number().int().min(1).max(200),
});

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Chưa chọn file để xem." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_PREVIEW_BYTES) {
    return NextResponse.json({ message: "File phải nhỏ hơn 40 MB." }, { status: 413 });
  }
  const fileType = PREVIEW_TYPES.get(path.extname(file.name).toLowerCase());
  if (!fileType) {
    return NextResponse.json({ message: "Định dạng xem trước không được hỗ trợ." }, { status: 415 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const preview = await renderDocumentPreview(buffer, fileType, file.name, 1);
    const session = preview.itemCount > 1
      ? createVisualPreviewSession(buffer, fileType, file.name)
      : null;
    return NextResponse.json({ ...preview, sessionId: session?.id ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể tạo bản xem trước.";
    return NextResponse.json({ message }, { status: 422 });
  }
}

export async function PUT(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = pageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Yêu cầu chuyển trang không hợp lệ." }, { status: 400 });
  }
  const session = getVisualPreviewSession(parsed.data.sessionId);
  if (!session) {
    return NextResponse.json({ message: "Bản xem tạm đã hết hạn. Hãy mở lại file." }, { status: 404 });
  }
  try {
    const preview = await renderDocumentPreview(
      session.buffer,
      session.fileType,
      session.title,
      parsed.data.item,
    );
    return NextResponse.json(preview);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể chuyển trang xem trước.";
    return NextResponse.json({ message }, { status: 422 });
  }
}

export async function DELETE(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId") ?? "";
  const parsed = z.string().uuid().safeParse(sessionId);
  if (!parsed.success) return new Response(null, { status: 400 });
  removeVisualPreviewSession(parsed.data);
  return new Response(null, { status: 204 });
}
