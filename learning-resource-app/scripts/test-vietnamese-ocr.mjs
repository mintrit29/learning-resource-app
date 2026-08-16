import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
process.env.DOCLING_RS_HOME ||= path.join(projectRoot, ".docling-runtime");
const fixtureRoot = path.join(projectRoot, "test-fixtures", "scholarflow-visual-search", "queries");
const { recognizeVietnameseImage, shutdownVietnameseOcr } = await import("../src/lib/documents/vietnamese-ocr.ts");
const { extractScannedPdfSections } = await import("../src/lib/documents/pdf-scan-ocr.ts");

try {
  const question = await recognizeVietnameseImage(await readFile(path.join(fixtureRoot, "01_anh_cau_hoi_ospf.png")));
  assert.match(question, /CÂU HỎI MẠNG MÁY TÍNH/);
  assert.match(question, /trạng thái liên kết/);
  assert.match(question, /Chuẩn hóa cơ sở dữ liệu/);

  const formula = await recognizeVietnameseImage(await readFile(path.join(fixtureRoot, "07_cong_thuc_va_bang.png")));
  assert.match(formula, /Độ chọn lọc/);
  assert.match(formula, /O\(\(V\s*\+\s*E\)\s*log\s*V\)/i);

  const blank = await recognizeVietnameseImage(await readFile(path.join(fixtureRoot, "06_vung_khong_co_chu.png")));
  assert.equal(blank, "");

  const scannedPages = await extractScannedPdfSections(
    await readFile(path.join(fixtureRoot, "02_de_thi_scan_hai_trang.pdf")),
  );
  assert.equal(scannedPages.length, 2);
  assert.equal(scannedPages[0]?.pageNumber, 1);
  assert.equal(scannedPages[1]?.pageNumber, 2);
  assert.match(scannedPages.map((section) => section.text).join("\n"), /Chuẩn hóa 3NF/);
  assert.match(scannedPages.map((section) => section.text).join("\n"), /Dijkstra không áp dụng trực tiếp/);
  console.log("PASS Vietnamese OCR: diacritics, formula, no-text image and two-page scanned PDF");
} finally {
  await shutdownVietnameseOcr();
}
