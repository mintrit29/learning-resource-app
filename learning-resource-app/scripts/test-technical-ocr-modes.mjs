import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createWorker, OEM, PSM } from "tesseract.js";

const projectRoot = process.cwd();
const fixtureRoot = path.join(projectRoot, "test-fixtures", "scholarflow-hybrid-ocr");
const tessdataRoot = process.env.SCHOLARFLOW_TESSDATA_PATH
  || path.join(process.env.DOCLING_RS_HOME || path.join(projectRoot, ".docling-runtime"), "models", "tesseract");
const cases = [
  { id: "english", file: "text_02_english.png", markers: ["documents"] },
  { id: "table", file: "table_01_vietnamese.png", markers: ["Cạnh âm"] },
  { id: "chart", file: "chart_01_line.png", markers: ["Tháng 1"] },
  { id: "diagram", file: "diagram_01_network.png", markers: ["R1", "R2", "R3", "R4"] },
  { id: "code", file: "code_01_snippet.png", markers: ["Infinity"] },
];

const report = [];
for (const [modeName, mode] of [["auto", PSM.AUTO], ["sparse", PSM.SPARSE_TEXT], ["block", PSM.SINGLE_BLOCK]]) {
  const worker = await createWorker("eng", OEM.LSTM_ONLY, { langPath: tessdataRoot, gzip: false, cacheMethod: "none" });
  await worker.setParameters({ tessedit_pageseg_mode: mode, preserve_interword_spaces: "1" });
  try {
    for (const testCase of cases) {
      const started = performance.now();
      const result = await worker.recognize(await readFile(path.join(fixtureRoot, testCase.file)));
      const text = result.data.text.replace(/\r/g, "").trim();
      const markerResults = testCase.markers.map((marker) => ({ marker, found: text.toLowerCase().includes(marker.toLowerCase()) }));
      report.push({ mode: modeName, id: testCase.id, ms: performance.now() - started, confidence: result.data.confidence, text, markerResults });
      console.log(`${modeName}/${testCase.id}: ${markerResults.filter((marker) => marker.found).length}/${markerResults.length} -> ${JSON.stringify(text)}`);
    }
  } finally {
    await worker.terminate();
  }
}

const reportPath = path.join(fixtureRoot, "technical-ocr-modes-report.json");
await writeFile(reportPath, JSON.stringify({ report }, null, 2), "utf8");
console.log(`REPORT=${reportPath}`);
