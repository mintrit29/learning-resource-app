import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
process.env.DOCLING_RS_HOME ||= path.join(projectRoot, ".docling-runtime");
process.env.PDFIUM_DYNAMIC_LIB_PATH ||= path.join(process.env.DOCLING_RS_HOME, "pdfium", "lib");

const fixtureRoot = path.join(projectRoot, "test-fixtures", "scholarflow", "05_ocr_regression");
const inputPath = path.join(fixtureRoot, "hybrid_content_stress.docx");
const reportPath = path.join(fixtureRoot, "document-extraction-report.json");
const { extractDocumentText } = await import("../src/lib/documents/extract-text.ts");
const { shutdownVietnameseOcr } = await import("../src/lib/documents/vietnamese-ocr.ts");

const nativeMarkers = [
  "Mã hóa dữ liệu",
  "tính bí mật",
  "Semantic search retrieves relevant documents",
  "T(n) = O((V + E) log V)",
  "Thuật toán",
  "Cạnh âm",
  "Dijkstra",
  "Không hỗ trợ",
];
const formulaMarkers = {
  quadratic: ["sqrt", "4", "a", "c"],
  gaussian: ["int", "infty", "sqrt", "pi"],
  bayes: ["P(A", "P(B"],
  ols: ["beta", "SSres", "SStot"],
  vector: ["nabla", "rho", "varepsilon"],
  entropy: ["H(X", "log"],
};

let result;
const started = performance.now();
try {
  result = await extractDocumentText(await readFile(inputPath), "docx");
} finally {
  await shutdownVietnameseOcr();
}

const normalized = result.text.toLowerCase().replaceAll("\\", "");
const nativeResults = nativeMarkers.map((marker) => ({ marker, found: normalized.includes(marker.toLowerCase()) }));
const formulaResults = Object.fromEntries(
  Object.entries(formulaMarkers).map(([id, markers]) => [
    id,
    { markers, found: markers.every((marker) => normalized.includes(marker.toLowerCase())) },
  ]),
);
const ocrSections = result.sections
  .filter((section) => section.sourceLabel.includes("OCR"))
  .map((section) => ({ sourceLabel: section.sourceLabel, text: section.text }));
const report = {
  elapsedMs: performance.now() - started,
  textLength: result.text.length,
  sectionCount: result.sections.length,
  ocrSectionCount: ocrSections.length,
  nativeResults,
  formulaResults,
  ocrSections,
};
await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
assert.equal(nativeResults.every((item) => item.found), true, `Native markers missing: ${JSON.stringify(nativeResults.filter((item) => !item.found))}`);
assert.equal(ocrSections.length, 10, `Expected 10 useful image OCR sections, received ${ocrSections.length}`);
assert.equal(
  ocrSections.filter((section) => section.sourceLabel.includes("Công thức ảnh")).length,
  6,
  "All six formula images must remain searchable even when exact transcription is imperfect.",
);
assert.equal(
  Object.values(formulaResults).filter((item) => item.found).length,
  2,
  "The current Tesseract baseline is expected to preserve Bayes and entropy marker groups exactly.",
);
console.log(JSON.stringify(report, null, 2));
console.log(`REPORT=${reportPath}`);
