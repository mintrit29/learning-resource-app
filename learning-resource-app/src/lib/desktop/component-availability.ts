import { access } from "node:fs/promises";
import path from "node:path";

const DOCLING_REQUIRED_FILES = [
  "models/layout_heron.onnx",
  "models/ocr_rec.onnx",
  "models/ppocr_keys_v1.txt",
  "models/tableformer/encoder.onnx",
  "models/tableformer/decoder.onnx",
  "models/tableformer/bbox.onnx",
  "pdfium/lib/pdfium.dll",
];

export async function isDoclingReady() {
  const root = process.env.DOCLING_RS_HOME?.trim();
  if (!root || !path.isAbsolute(root)) return false;
  return Promise.all(DOCLING_REQUIRED_FILES.map((file) => access(path.join(
    /* turbopackIgnore: true */ root,
    file,
  ))))
    .then(() => true)
    .catch(() => false);
}

export const DOCLING_MISSING_MESSAGE = "Docling chưa được cài đặt. Hãy mở Cài đặt → Thành phần cục bộ để tải trước khi thêm hoặc trích xuất lại tài liệu.";
