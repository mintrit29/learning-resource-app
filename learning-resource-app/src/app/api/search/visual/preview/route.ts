import path from "node:path";
import { NextResponse } from "next/server";
import { renderDocumentPreview, type PreviewFileType } from "@/lib/documents/render-document-preview";

export const runtime = "nodejs";

const MAX_PREVIEW_BYTES = 40 * 1024 * 1024;
const PREVIEW_TYPES = new Map<string, PreviewFileType>([
  [".docx", "DOCX"],
  [".pptx", "PPTX"],
  [".epub", "EPUB"],
]);

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
    const preview = await renderDocumentPreview(Buffer.from(await file.arrayBuffer()), fileType, file.name);
    return NextResponse.json(preview);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể tạo bản xem trước.";
    return NextResponse.json({ message }, { status: 422 });
  }
}
