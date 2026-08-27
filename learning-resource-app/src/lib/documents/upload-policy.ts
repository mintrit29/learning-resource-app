import type { SupportedExtension } from "@/lib/documents/extract-text";

export const MAX_UPLOAD_FILE_SIZE_MB = 25;
export const MAX_UPLOAD_FILE_SIZE_BYTES = MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024;
export const MAX_BATCH_UPLOAD_FILES = 100;
export const SUPPORTED_UPLOAD_EXTENSIONS = [
  "pdf", "pptx", "docx", "epub", "xmind",
  "png", "jpg", "jpeg", "webp",
  "mp3", "wav", "m4a",
] as const satisfies readonly SupportedExtension[];
export const SUPPORTED_UPLOAD_ACCEPT = SUPPORTED_UPLOAD_EXTENSIONS.map((extension) => `.${extension}`).join(",");
export const SUPPORTED_UPLOAD_LABEL = "PDF, PPTX, DOCX, EPUB, XMind, ảnh mind map và MP3/WAV/M4A";

