import { readFile } from "node:fs/promises";
import { db } from "@/lib/db";
import {
  renderDocumentPreview,
  type PreviewFileType,
} from "@/lib/documents/render-document-preview";
import { resolveStoredUploadPath } from "@/lib/storage/local-storage";

export const runtime = "nodejs";

const previewableTypes = new Set<PreviewFileType>(["DOCX", "PPTX", "EPUB"]);

function errorPage(message: string, status: number) {
  const safeMessage = message.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return new Response(
    `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font-family:Segoe UI,Arial,sans-serif;padding:32px;color:#52615d"><h1 style="color:#17211f;font-size:20px">Không thể xem tài liệu</h1><p>${safeMessage}</p></body></html>`,
    { status, headers: previewHeaders("no-store") },
  );
}

function previewHeaders(cacheControl = "private, max-age=3600") {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": cacheControl,
    "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "no-referrer",
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const itemValue = new URL(request.url).searchParams.get("item");
  const itemNumber = itemValue && /^\d{1,3}$/.test(itemValue) ? Number(itemValue) : undefined;
  if (itemNumber !== undefined && (itemNumber < 1 || itemNumber > 200)) {
    return errorPage("Vị trí xem trước không hợp lệ.", 400);
  }
  const document = await db.document.findFirst({
    where: { id },
    select: { filePath: true, fileType: true, originalFileName: true },
  });
  if (!document) return errorPage("Không tìm thấy tài liệu.", 404);
  if (!previewableTypes.has(document.fileType as PreviewFileType)) {
    return errorPage("Định dạng này không cần bộ xem chuyển đổi.", 415);
  }

  const absolutePath = resolveStoredUploadPath(document.filePath);
  if (!absolutePath) return errorPage("Đường dẫn file không hợp lệ.", 400);
  const file = await readFile(absolutePath).catch(() => null);
  if (!file) return errorPage("File gốc không còn tồn tại.", 404);

  try {
    const preview = await renderDocumentPreview(
      file,
      document.fileType as PreviewFileType,
      document.originalFileName,
      document.fileType === "PPTX" || document.fileType === "EPUB" ? itemNumber : undefined,
    );
    return new Response(preview.html, { headers: previewHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể tạo bản xem nhanh.";
    return errorPage(message, 422);
  }
}
