import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { decodeSearchRegionDataUrl } from "../src/lib/search/visual-search-input.ts";
import { mergeRecognizedText, normalizeVisualQueryText } from "../src/lib/search/visual-query.ts";
import { normalizeVietnameseOcrText } from "../src/lib/documents/vietnamese-ocr.ts";
import { createVisualPreviewSession, getVisualPreviewSession, removeVisualPreviewSession } from "../src/lib/search/visual-preview-sessions.ts";
import { clearVisualSearchDraft, readVisualSearchDraft, saveVisualSearchDraft } from "../src/lib/search/visual-search-draft.ts";
import { clearUploadDraft, readUploadDraft, saveUploadDraft } from "../src/lib/documents/upload-draft.ts";

const require = createRequire(import.meta.url);
const { normalizeCaptureRectangle, targetOcrSize } = require("../electron/visual-search.cjs");

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
assert.deepEqual(decodeSearchRegionDataUrl(`data:image/png;base64,${png.toString("base64")}`), png);
assert.throws(() => decodeSearchRegionDataUrl("data:image/svg+xml;base64,PHN2Zz4="), /PNG hoặc JPEG/);
assert.throws(() => decodeSearchRegionDataUrl("data:image/png;base64,SGVsbG8="), /không hợp lệ/);

assert.deepEqual(
  normalizeCaptureRectangle({ x: 10.4, y: 20.5, width: 100.2, height: 80.8 }, { width: 800, height: 600 }),
  { x: 10, y: 21, width: 100, height: 81 },
);
assert.throws(() => normalizeCaptureRectangle({ x: 0, y: 0, width: 5, height: 5 }, { width: 800, height: 600 }), /quá nhỏ/);
assert.throws(() => normalizeCaptureRectangle({ x: 750, y: 0, width: 100, height: 100 }, { width: 800, height: 600 }), /ngoài cửa sổ/);
assert.throws(() => normalizeCaptureRectangle({ x: 0, y: 0, width: 4000, height: 3000 }, { width: 5000, height: 5000 }), /quá lớn/);
assert.deepEqual(targetOcrSize(400, 150), { width: 1200, height: 450 });
assert.deepEqual(targetOcrSize(1600, 900), { width: 1600, height: 900 });
assert.deepEqual(targetOcrSize(100, 50), { width: 300, height: 150 });
assert.throws(() => targetOcrSize(0, 100), /không hợp lệ/);
assert.equal(normalizeVisualQueryText("  khóa   chính\nkhóa ngoại "), "khóa chính khóa ngoại");
assert.equal(mergeRecognizedText("Hệ quản trị cơ sở dữ liệu", "Hệ quản trị cơ sở dữ liệu"), "Hệ quản trị cơ sở dữ liệu");
assert.equal(mergeRecognizedText("đoạn mới được OCR", "đoạn cũ nằm ngoài vùng"), "đoạn mới được OCR");
assert.equal(mergeRecognizedText("", "text thật dùng dự phòng"), "text thật dùng dự phòng");
assert.equal(
  normalizeVietnameseOcrText("Câu 4. Đồ thị có cạnh âm?\nII —............................\n"),
  "Câu 4. Đồ thị có cạnh âm?",
);

const previewSession = createVisualPreviewSession(Buffer.from("temporary preview"), "PPTX", "test.pptx");
assert.equal(getVisualPreviewSession(previewSession.id)?.title, "test.pptx");
assert.equal(removeVisualPreviewSession(previewSession.id), true);
assert.equal(getVisualPreviewSession(previewSession.id), null);

const localFile = { name: "de-thi.pdf", size: 1024 };
saveVisualSearchDraft({
  file: localFile,
  previewHtml: "<p>Câu hỏi</p>",
  previewItemCount: 2,
  currentPreviewItem: 1,
  previewSessionId: "preview-1",
  zoom: 1,
  viewerMode: "select",
  selection: { x: 10, y: 10, width: 100, height: 50 },
  query: "câu hỏi được chọn",
  capturedPreview: "data:image/png;base64,test",
  results: [],
  searchStatus: "NO_RELEVANT_RESULTS",
});
assert.equal(readVisualSearchDraft()?.file, localFile);
assert.equal(readVisualSearchDraft()?.query, "câu hỏi được chọn");
clearVisualSearchDraft();
assert.equal(readVisualSearchDraft(), null);

saveUploadDraft([{ id: "draft-1", file: localFile, status: "uploading" }]);
assert.equal(readUploadDraft()[0]?.status, "ready");
assert.equal(readUploadDraft()[0]?.file, localFile);
clearUploadDraft();
assert.deepEqual(readUploadDraft(), []);

console.log("Visual search input tests passed.");
