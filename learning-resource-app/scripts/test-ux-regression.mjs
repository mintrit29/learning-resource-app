import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { getUploadFeedback } from "../src/lib/documents/upload-draft.ts";
import { getDocumentDisplayStatus } from "../src/lib/documents/display-status.ts";
import { isSkippedAnalysisJob } from "../src/lib/documents/optional-analysis.ts";
import { libraryHref, libraryReturnHref } from "../src/lib/documents/library-navigation.ts";
import { previewVisitUrl } from "../src/lib/documents/preview-navigation.ts";

const failed = { id: "bad", status: "error", needsComponent: true };
assert.match(getUploadFeedback([failed], false).message, /^1 file/);
assert.equal(getUploadFeedback([failed], false).needsComponent, true);
assert.deepEqual(getUploadFeedback([], false), { message: "", needsComponent: false });
assert.match(getUploadFeedback([failed, { ...failed, id: "two" }], false).message, /^2 file/);
assert.equal(getUploadFeedback([{ ...failed, status: "uploaded" }], false).message, "");
assert.equal(getUploadFeedback([{ ...failed, status: "uploading" }], true).needsComponent, false);
assert.equal(getUploadFeedback([failed], true).message, "");

const baseJobs = ["EXTRACT_TEXT", "CHUNK_DOCUMENT", "EMBED_DOCUMENT"].map(type => ({ type, status: "COMPLETED" }));
const document = { status: "READY", textContent: "Text with searchable content" };
const legacy = { type: "ANALYZE_DOCUMENT", status: "FAILED", errorMessage: "Chưa có kết nối AI đang hoạt động." };
for (const job of [legacy, { type: "ANALYZE_DOCUMENT", status: "SKIPPED" }]) {
  assert.equal(isSkippedAnalysisJob(job), true);
  const status = getDocumentDisplayStatus(document, [...baseJobs, job]);
  assert.equal(status.className, "ready");
  assert.equal(status.isReadyToAsk, true);
  assert.match(status.label, /Chưa phân tích AI/);
}
assert.equal(isSkippedAnalysisJob({ ...legacy, type: "EMBED_DOCUMENT" }), false);
assert.equal(isSkippedAnalysisJob({ ...legacy, errorMessage: "API key không hợp lệ" }), false);
assert.equal(getDocumentDisplayStatus(document, [...baseJobs, { ...legacy, errorMessage: "API key không hợp lệ" }]).className, "warning");
assert.equal(getDocumentDisplayStatus(document, [...baseJobs, { type: "EMBED_DOCUMENT", status: "FAILED" }, legacy]).className, "failed");

const href = libraryHref({ q: " ospf & subnet ", topic: "Hệ thống mạng", fileType: "DOCX", status: "READY" });
const restored = new URL(libraryReturnHref(href, "doc1"), "http://test");
assert.equal(restored.pathname, "/documents");
assert.equal(restored.searchParams.get("q"), "ospf & subnet");
assert.equal(restored.searchParams.get("topic"), "Hệ thống mạng");
assert.equal(restored.hash, "#document-doc1");
for (const unsafe of ["https://evil.test/documents", "//evil.test/documents", "javascript:alert(1)", "/documents/../settings", "/settings", "x".repeat(9000)]) {
  assert.equal(libraryReturnHref(unsafe, "doc1"), "/documents");
}
assert.equal(libraryReturnHref("/documents?unexpected=1&q=OSPF#bad", "doc1"), "/documents?q=OSPF#document-doc1");
assert.equal(libraryReturnHref(undefined, "doc1"), "/documents");
console.log("PASS UX state: upload errors, optional AI/legacy jobs, safe library return URLs");

const previewSource = "/api/documents/doc1/preview?item=2&chunk=chunk1#matched-preview";
const firstVisit = new URL(previewVisitUrl(previewSource, "http://127.0.0.1:3000/documents/doc1", "first"));
const nextVisit = new URL(previewVisitUrl(firstVisit.href, "http://127.0.0.1:3000/search", "next"));
assert.equal(firstVisit.hash, "#matched-preview");
assert.equal(nextVisit.hash, "#matched-preview");
assert.equal(nextVisit.searchParams.get("item"), "2");
assert.equal(nextVisit.searchParams.get("chunk"), "chunk1");
assert.equal(nextVisit.searchParams.get("visit"), "next");
assert.equal(nextVisit.searchParams.getAll("visit").length, 1);
assert.notEqual(firstVisit.href, nextVisit.href);
assert.throws(() => previewVisitUrl("https://outside.test/preview", "http://127.0.0.1:3000", "id"), /stay in the app/);
console.log("PASS preview navigation: new visit preserves matched chunk, sheet, fragment and same origin");

// Real database and analysis path, with an isolated loopback provider (no cloud calls).
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "scholarflow-ux-test-"));
process.env.DATABASE_URL = `file:${path.join(temporaryRoot, "qa.db").replaceAll("\\", "/")}`;
process.env.SCHOLARFLOW_DATA_ROOT = temporaryRoot;
const { db } = await import("../src/lib/db.ts");
const { analyzeDocument } = await import("../src/lib/ai/analyze-document.ts");
let responseStatus = 401;
const server = createServer(async (req, res) => {
  for await (const chunk of req) void chunk;
  res.writeHead(responseStatus, { "content-type": "application/json" });
  res.end(JSON.stringify(responseStatus === 200 ? {
    choices: [{ message: { content: JSON.stringify({ topicId: null, confidence: 0, difficulty: "BEGINNER", language: "Vietnamese", summary: "Bản tóm tắt giả chỉ dùng để kiểm thử đường đi thành công của ứng dụng.", reason: "Dữ liệu test không phân loại vào môn cụ thể." }) } }],
  } : { error: { message: "Invalid test key" } }));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
  const doc = await db.document.create({ data: { title: "QA", originalFileName: "qa.pdf", fileType: "PDF", filePath: "qa.pdf", fileSize: 1, textContent: "Nội dung giả cho kiểm thử AI tùy chọn.", status: "EXTRACTED" } });
  const job = await db.analysisJob.create({ data: { documentId: doc.id, type: "ANALYZE_DOCUMENT" } });
  assert.equal(await analyzeDocument(doc.id, job.id), true);
  assert.equal((await db.analysisJob.findUniqueOrThrow({ where: { id: job.id } })).status, "SKIPPED");
  assert.equal((await db.document.findUniqueOrThrow({ where: { id: doc.id } })).status, "READY");
  await db.aiProvider.create({ data: { displayName: "QA loopback", type: "CUSTOM", baseUrl: `http://127.0.0.1:${server.address().port}/v1`, defaultChatModel: "qa", isActive: true } });
  assert.equal(await analyzeDocument(doc.id, job.id), false);
  assert.equal((await db.analysisJob.findUniqueOrThrow({ where: { id: job.id } })).status, "FAILED");
  responseStatus = 200;
  assert.equal(await analyzeDocument(doc.id, job.id), true);
  assert.equal((await db.analysisJob.findUniqueOrThrow({ where: { id: job.id } })).status, "COMPLETED");
  assert.match((await db.document.findUniqueOrThrow({ where: { id: doc.id } })).summary, /Bản tóm tắt giả/);
  console.log("PASS analysis integration: absent provider skips; configured failure remains failed; retry succeeds");
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await db.$disconnect();
  const resolved = path.resolve(temporaryRoot);
  assert.equal(path.dirname(resolved), path.resolve(tmpdir()));
  assert.ok(path.basename(resolved).startsWith("scholarflow-ux-test-"));
  await rm(resolved, { recursive: true, force: true });
}
