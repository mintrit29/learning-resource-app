import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const projectRoot = process.cwd();
process.env.DOCLING_RS_HOME ||= path.join(projectRoot, ".docling-runtime");
process.env.PDFIUM_DYNAMIC_LIB_PATH ||= path.join(process.env.DOCLING_RS_HOME, "pdfium", "lib");
const fixtureRoot = path.join(projectRoot, "test-fixtures", "scholarflow-visual-search", "queries");
const {
  mergeVietnameseAndTechnicalOcrText,
  recognizeVietnameseImage,
  shutdownVietnameseOcr,
} = await import("../src/lib/documents/vietnamese-ocr.ts");
const { extractScannedPdfSections } = await import("../src/lib/documents/pdf-scan-ocr.ts");
const { extractPdfEmbeddedImages } = await import("../src/lib/documents/pdf-embedded-images.ts");
const { recognizeSearchRegion } = await import("../src/lib/documents/ocr-region.ts");
const { removeLongGridLines } = await import("../src/lib/search/visual-grid-cleanup.ts");

try {
  const question = await recognizeVietnameseImage(await readFile(path.join(fixtureRoot, "01_anh_cau_hoi_ospf.png")));
  assert.match(question, /CÂU HỎI MẠNG MÁY TÍNH/);
  assert.match(question, /trạng thái liên kết/);
  assert.match(question, /Chuẩn hóa cơ sở dữ liệu/);

  const formulaImage = await readFile(path.join(fixtureRoot, "07_cong_thuc_va_bang.png"));
  const formula = await recognizeVietnameseImage(formulaImage);
  assert.match(formula, /T\(n\)\s*=/);
  assert.match(formula, /Độ chọn lọc/);
  assert.match(formula, /O\(\(V\s*\+\s*E\)\s*log\s*V\)/i);
  assert.match(await recognizeSearchRegion(formulaImage), /T\(n\)\s*=/);

  const sourceImage = await loadImage(formulaImage);
  const tableOnlyCanvas = createCanvas(1440, 520);
  const tableContext = tableOnlyCanvas.getContext("2d");
  tableContext.drawImage(sourceImage, 90, 350, 1440, 520, 0, 0, 1440, 520);
  const tableImageData = tableContext.getImageData(0, 0, 1440, 520);
  assert.equal(removeLongGridLines(tableImageData.data, 1440, 520), true);
  tableContext.putImageData(tableImageData, 0, 0);
  const tableOnly = await recognizeVietnameseImage(tableOnlyCanvas.toBuffer("image/png"));
  assert.match(tableOnly, /Thuật toán/i);
  assert.match(tableOnly, /Cấu trúc/i);
  assert.match(tableOnly, /Cạnh âm/i);
  assert.match(tableOnly, /Độ phức tạp/i);
  assert.match(tableOnly, /Dijkstra/i);
  assert.match(tableOnly, /Không hỗ trợ/i);

  const screenTableCanvas = createCanvas(594, 214);
  screenTableCanvas.getContext("2d").drawImage(tableOnlyCanvas, 0, 0, 594, 214);
  const capturedTableCanvas = createCanvas(1388, 500);
  capturedTableCanvas.getContext("2d").drawImage(screenTableCanvas, 0, 0, 1388, 500);
  const capturedTable = await recognizeVietnameseImage(capturedTableCanvas.toBuffer("image/png"));
  assert.match(capturedTable, /Độ phức tạp/i);
  assert.match(capturedTable, /Không hỗ trợ/i);

  assert.equal(
    mergeVietnameseAndTechnicalOcrText(
      "Tín) = O((V + E) log V)\nĐộ chọn lọc = số bản ghi thỏa điều kiện",
      "T(n) = O((V + E) log V)\nD6 chon loc = so ban ghi thoa dieu kien",
    ),
    "T(n) = O((V + E) log V)\nĐộ chọn lọc = số bản ghi thỏa điều kiện",
  );
  assert.equal(
    mergeVietnameseAndTechnicalOcrText(
      "Semantic search retrieves relevant",
      "Semantic search retrieves relevant documents",
    ),
    "Semantic search retrieves relevant documents",
  );
  assert.equal(
    mergeVietnameseAndTechnicalOcrText("Tnfinity;", "Infinity;"),
    "Infinity;",
  );
  assert.equal(
    mergeVietnameseAndTechnicalOcrText(
      "Mã hóa dữ liệu bảo đảm tính toàn vẹn",
      "Ma hoa du lieu bao dam tinh toan ven",
    ),
    "Mã hóa dữ liệu bảo đảm tính toàn vẹn",
  );

  const blank = await recognizeVietnameseImage(await readFile(path.join(fixtureRoot, "06_vung_khong_co_chu.png")));
  assert.equal(blank, "");
  await assert.rejects(
    recognizeSearchRegion(await readFile(path.join(fixtureRoot, "06_vung_khong_co_chu.png"))),
    /Không nhận ra đủ chữ|Không nhận dạng đủ chắc chắn/,
  );

  const scannedPdf = await readFile(path.join(fixtureRoot, "02_de_thi_scan_hai_trang.pdf"));
  const embeddedPages = await extractPdfEmbeddedImages(scannedPdf);
  assert.deepEqual(embeddedPages.map((image) => image.pageNumber), [1, 2]);
  const scannedPages = await extractScannedPdfSections(scannedPdf);
  assert.equal(scannedPages.length, 2);
  assert.equal(scannedPages[0]?.pageNumber, 1);
  assert.equal(scannedPages[1]?.pageNumber, 2);
  assert.match(scannedPages.map((section) => section.text).join("\n"), /Chuẩn hóa 3NF/);
  assert.match(scannedPages.map((section) => section.text).join("\n"), /Dijkstra không áp dụng trực tiếp/);
  console.log("PASS Vietnamese OCR: diacritics, formula, no-text image and two-page scanned PDF");
} finally {
  await shutdownVietnameseOcr();
}
