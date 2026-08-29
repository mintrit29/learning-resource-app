import assert from "node:assert/strict";
import "./test-ui-actions.mjs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { getUploadFeedback } from "../src/lib/documents/upload-draft.ts";
import { getDocumentDisplayStatus } from "../src/lib/documents/display-status.ts";
import { isSkippedAnalysisJob } from "../src/lib/documents/optional-analysis.ts";
import { libraryHref, libraryReturnHref } from "../src/lib/documents/library-navigation.ts";
import { previewVisitUrl } from "../src/lib/documents/preview-navigation.ts";
import { createSearchDraft, restoreSearchState, searchSignature, EMPTY_FILTERS } from "../src/lib/search/search-state.ts";
import { visualDraftError, saveVisualSearchDraft, readVisualSearchDraft, clearVisualSearchDraft } from "../src/lib/search/visual-search-draft.ts";
import { editUploadItems, getUploadSnapshot, subscribeUploadSession, uploadPendingFiles } from "../src/lib/documents/upload-session.ts";

// Scope documentation belongs in README/docs, not an extra product screen.
await assert.rejects(readFile(new URL("../src/app/(dashboard)/help/page.tsx", import.meta.url)), { code: "ENOENT" });
for (const filename of [
  "app/(dashboard)/settings/page.tsx", "app/(dashboard)/upload/page.tsx",
  "app/(dashboard)/documents/[id]/page.tsx", "components/layout/project-header.tsx",
  "components/search/semantic-search.tsx", "components/search/visual-resource-search.tsx",
]) {
  const source = await readFile(new URL(`../src/${filename}`, import.meta.url), "utf8");
  assert.doesNotMatch(source, /href="\/help|@\/lib\/capabilities|LIMIT_NOTICE/, filename);
}
assert.match(await readFile(new URL("../../README.md", import.meta.url), "utf8"), /APP_CAPABILITIES\.md/);
assert.match(await readFile(new URL("../../APP_CAPABILITIES.md", import.meta.url), "utf8"), /Phân biệt giới hạn và lỗi/);
console.log("PASS scope documentation retained in README/docs; removed help route and UI notices have no dangling references");

const completedSearch = { query: "chuẩn hóa 3NF", filters: EMPTY_FILTERS, appliedFilters: EMPTY_FILTERS, results: [{ fileType: "XMIND" }], status: "OK" };
for (const query of ["", " ", "x", "câu hỏi mới"]) {
  const restored = restoreSearchState(createSearchDraft(query, EMPTY_FILTERS));
  assert.equal(restored.query, query);
  assert.deepEqual(restored.results, []);
  assert.equal(restored.signature, "");
  assert.equal(restored.searchedQuery, "");
}
for (const fileType of ["PDF", "DOCX"]) {
  const filters = { ...EMPTY_FILTERS, fileType };
  const changed = restoreSearchState(createSearchDraft(completedSearch.query, filters));
  assert.equal(changed.filters.fileType, fileType);
  assert.deepEqual(changed.results, []);
  assert.equal(changed.signature, "");
  // Also repair old snapshots written by the previous buggy updateFilter.
  const legacyMismatch = restoreSearchState({ ...completedSearch, filters });
  assert.deepEqual(legacyMismatch.results, []);
  assert.equal(legacyMismatch.status, null);
  assert.equal(legacyMismatch.signature, "");
}
for (const status of ["NO_RELEVANT_RESULTS", "EMPTY_LIBRARY"]) {
  const restored = restoreSearchState({ ...completedSearch, results: [], status });
  assert.equal(restored.searchedQuery, completedSearch.query);
  assert.equal(restored.status, status);
  assert.equal(restored.signature, searchSignature(completedSearch.query, EMPTY_FILTERS));
}
assert.deepEqual(restoreSearchState(completedSearch).results, completedSearch.results);
assert.equal(searchSignature(" OSPF ", EMPTY_FILTERS), searchSignature("OSPF", { fileType: "", difficulty: "", topic: "" }));

const brokenPreview = { file: { name: "broken.xmind" }, previewHtml: "", error: "thiếu content.json hoặc content.xml" };
saveVisualSearchDraft(brokenPreview);
assert.equal(visualDraftError(readVisualSearchDraft()), brokenPreview.error);
assert.match(visualDraftError({ ...brokenPreview, error: "" }), /chưa hoàn tất/);
assert.equal(visualDraftError({ ...brokenPreview, previewHtml: "<p>Ready</p>", error: "" }), "");
assert.equal(visualDraftError({ file: { name: "image.png" }, previewHtml: "" }), "");
assert.equal(visualDraftError({ file: { name: "bad.png" }, previewHtml: "", previewError: "Không đọc được ảnh", error: "" }), "Không đọc được ảnh");
assert.equal(visualDraftError({ ...brokenPreview, previewHtml: "<p>Ready</p>", error: "Search failed" }), "", "A search error must not become a permanent preview error");
assert.equal(visualDraftError(null), "");
clearVisualSearchDraft();
console.log("PASS unhappy search state: clear/edit, filter invalidation, legacy mismatch, empty-result restoration, failed/interrupted preview");

const uploadItem = id => ({ id, file: new File(["QA"], `${id}.pdf`, { type: "application/pdf" }), status: "ready" });
editUploadItems(() => [uploadItem("good"), uploadItem("bad")]);
let releaseUpload;
let uploadCalls = 0;
let notifications = 0;
const unsubscribeUpload = subscribeUploadSession(() => { notifications += 1; });
const batch = uploadPendingFiles(async () => {
  uploadCalls += 1;
  if (uploadCalls === 1) return new Promise(resolve => { releaseUpload = resolve; });
  return Response.json({ message: "File hỏng" }, { status: 400 });
});
assert.equal(getUploadSnapshot().isUploading, true);
assert.equal(await uploadPendingFiles(), null, "A second mount/click cannot start another batch");
editUploadItems(() => []);
assert.equal(getUploadSnapshot().items.length, 2, "In-flight items cannot be removed/replaced");
unsubscribeUpload(); // Simulate leaving the upload page before the response.
releaseUpload(Response.json({ documentId: "new-document" }));
assert.equal((await batch).failedCount, 1);
assert.equal(uploadCalls, 2);
assert.equal(getUploadSnapshot().isUploading, false);
assert.equal(getUploadSnapshot().items[0].status, "uploaded");
assert.equal(getUploadSnapshot().items[1].status, "error");
assert.ok(notifications > 0);
let retryCalls = 0;
await uploadPendingFiles(async () => { retryCalls += 1; return Response.json({ documentId: "retried-document" }); });
assert.equal(retryCalls, 1, "Retry sends only the failed item, never the already uploaded document");
assert.deepEqual(getUploadSnapshot().items, []);
editUploadItems(() => [uploadItem("network")]);
await uploadPendingFiles(async () => { throw new Error("offline"); });
assert.equal(getUploadSnapshot().items[0].status, "error");
assert.equal(getUploadSnapshot().isUploading, false);
editUploadItems(() => []);
console.log("PASS upload session: late response after unmount, shared status, concurrent-batch lock, partial failure, retry and offline recovery");

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
