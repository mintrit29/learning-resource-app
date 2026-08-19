import assert from "node:assert/strict";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
process.env.DOCLING_RS_HOME ||= path.join(projectRoot, ".docling-runtime");
process.env.PDFIUM_DYNAMIC_LIB_PATH ||= path.join(process.env.DOCLING_RS_HOME, "pdfium", "lib");

const fixtureRoot = path.join(projectRoot, "test-fixtures", "scholarflow-hybrid-ocr");
const reportPath = path.join(fixtureRoot, "routing-report.json");
const manifest = JSON.parse(await readFile(path.join(fixtureRoot, "manifest.json"), "utf8"));
const legacyFormulaRoot = path.join(projectRoot, ".tmp-codeformula-inputs", "word", "media");
const visualQueryRoot = path.join(projectRoot, "test-fixtures", "scholarflow-visual-search", "queries");
const validationFixtures = [
  { id: "actual_formula_gaussian", filePath: path.join(legacyFormulaRoot, "image1.png"), expectedRoute: "formula", expectedMarkers: ["int", "sqrt"], description: "Ảnh công thức Gaussian từ stress file thực tế." },
  { id: "actual_formula_ols", filePath: path.join(legacyFormulaRoot, "image2.png"), expectedRoute: "formula", expectedMarkers: ["beta", "R", "SS"], description: "Ảnh OLS/R² từ stress file thực tế." },
  { id: "actual_formula_bayes", filePath: path.join(legacyFormulaRoot, "image3.png"), expectedRoute: "formula", expectedMarkers: ["P", "H", "log"], description: "Ảnh Bayes/entropy từ stress file thực tế." },
  { id: "actual_chart_line", filePath: path.join(legacyFormulaRoot, "image4.png"), expectedRoute: "ocr", expectedMarkers: ["Extraction Accuracy"], description: "Biểu đồ đường từ stress file thực tế." },
  { id: "actual_chart_bar", filePath: path.join(legacyFormulaRoot, "image5.png"), expectedRoute: "ocr", expectedMarkers: ["Recovery"], description: "Biểu đồ cột từ stress file thực tế." },
  { id: "actual_question_image", filePath: path.join(visualQueryRoot, "01_anh_cau_hoi_ospf.png"), expectedRoute: "ocr", expectedMarkers: ["OSPF"], description: "Ảnh câu hỏi tiếng Việt hiện dùng trong visual search." },
  { id: "actual_mixed_formula_table", filePath: path.join(visualQueryRoot, "07_cong_thuc_va_bang.png"), expectedRoute: "ocr", expectedMarkers: ["T(n)", "Dijkstra"], description: "Trang trộn công thức đơn giản và bảng; xử lý OCR toàn vùng thay vì formula VLM." },
  { id: "actual_blank", filePath: path.join(visualQueryRoot, "06_vung_khong_co_chu.png"), expectedRoute: "reject", expectedMarkers: [], description: "Vùng trắng hiện dùng để kiểm tra query rỗng." },
];
const existingValidationFixtures = [];
for (const fixture of validationFixtures) {
  if (await access(fixture.filePath).then(() => true).catch(() => false)) {
    existingValidationFixtures.push(fixture);
  }
}
const allFixtures = [
  ...manifest.fixtures.map((fixture) => ({ ...fixture, filePath: path.join(fixtureRoot, fixture.file) })),
  ...existingValidationFixtures,
];
const { recognizeVietnameseImage, shutdownVietnameseOcr } = await import(
  "../src/lib/documents/vietnamese-ocr.ts"
);
const { analyzeVisualOcrImage, chooseVisualOcrRoute, countVisualMathSignals } = await import(
  "../src/lib/documents/visual-ocr-routing.ts"
);

function normalizeForMarker(value) {
  return value.normalize("NFC").toLocaleLowerCase("vi").replace(/\s+/g, " ").trim();
}

const rows = [];
try {
  for (const fixture of allFixtures) {
    const imagePath = fixture.filePath;
    const imageBuffer = await readFile(imagePath);
    const metrics = await analyzeVisualOcrImage(imageBuffer);
    const started = performance.now();
    const ocrText = await recognizeVietnameseImage(imageBuffer);
    const ocrMs = performance.now() - started;
    const actualRoute = chooseVisualOcrRoute(ocrText, metrics);
    const decision = {
      route: actualRoute,
      mathSignals: countVisualMathSignals(ocrText),
      naturalWords: (ocrText.match(/\p{L}{3,}/gu) ?? []).length,
    };
    const normalizedOcr = normalizeForMarker(ocrText);
    const markerResults = fixture.expectedMarkers.map((marker) => ({
      marker,
      found: normalizedOcr.includes(normalizeForMarker(marker)),
    }));
    rows.push({ ...fixture, actualRoute: decision.route, ocrMs, ocrText, markerResults, metrics, decision });
    console.log(`${fixture.id}: expected=${fixture.expectedRoute}, actual=${decision.route}, math=${decision.mathSignals}, words=${decision.naturalWords}`);
  }
} finally {
  await shutdownVietnameseOcr();
}

const mismatches = rows.filter((row) => row.expectedRoute !== row.actualRoute);
const missingOcrMarkers = rows
  .filter((row) => row.expectedRoute === "ocr")
  .flatMap((row) => row.markerResults.filter((marker) => !marker.found).map((marker) => ({ id: row.id, marker: marker.marker })));
await writeFile(
  reportPath,
  JSON.stringify({ generatedAt: new Date().toISOString(), total: rows.length, mismatches, rows }, null, 2),
  "utf8",
);
assert.deepEqual(
  mismatches.map((row) => ({ id: row.id, expected: row.expectedRoute, actual: row.actualRoute })),
  [],
  `Formula router mismatches: ${JSON.stringify(mismatches.map((row) => row.id))}`,
);
if (process.env.STRICT_OCR_MARKERS === "1") {
  assert.deepEqual(missingOcrMarkers, [], `Missing OCR markers: ${JSON.stringify(missingOcrMarkers)}`);
}
if (missingOcrMarkers.length > 0) {
  console.warn(`WARN missing OCR markers (${missingOcrMarkers.length}): ${JSON.stringify(missingOcrMarkers)}`);
}
console.log(`PASS hybrid OCR routing: ${rows.length}/${rows.length}; report=${reportPath}`);
