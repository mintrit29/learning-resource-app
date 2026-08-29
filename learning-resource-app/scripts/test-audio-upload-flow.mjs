// Run against scripts/start-audio-test-server.mjs only. Does not modify the user's library.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
const root = path.resolve(process.env.QA_AUDIO_ROOT || ".tmp/audio-small-integration-20260828");
assert.ok(root.startsWith(path.join(process.cwd(), ".tmp") + path.sep));
const fixtures = path.resolve("test-fixtures/scholarflow/06_mindmap_audio/11_audio_quality");
const { origin, runtime, root: serverRoot } = JSON.parse(await readFile(path.join(root, "server.json"), "utf8"));
assert.equal(root, serverRoot);
for (const url of [origin, runtime]) assert.equal(new URL(url).hostname, "127.0.0.1");
assert.equal((await fetch(origin + "/api/health", { headers: { "x-scholarflow-health-token": "audio-upload-qa-only" } })).status, 200);
for (let i = 0; i < 120; i++) {
  const health = await fetch(runtime + "/health").then(r => r.json());
  assert.notEqual(health.backend, "mock");
  if (health.status === "ready") break;
  if (i === 119) throw new Error("Real BGE did not become ready");
  await new Promise(resolve => setTimeout(resolve, 500));
}
await fetch(origin + "/documents");
const db = new Database(path.join(root, "data/scholarflow.db"), { readonly: true, fileMustExist: true });
assert.equal(db.prepare("SELECT count(*) n FROM AiProvider").get().n, 0);
assert.equal(db.prepare("SELECT count(*) n FROM Document").get().n, 0, "Use a fresh QA_AUDIO_ROOT for each run");
const rows = [];
async function waitJobs(id) {
  for (let i = 0; i < 480; i++) {
    const jobs = db.prepare("SELECT type,status,errorMessage FROM AnalysisJob WHERE documentId=?").all(id);
    if (jobs.length === 4 && jobs.every(j => ["COMPLETED", "SKIPPED", "FAILED"].includes(j.status))) return jobs;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Job timeout ${id}`);
}
try {
  for (const name of ["short-vi.mp3", "short-vi.wav", "short-vi.m4a", "lecture-vi.mp3", "lecture-vi.wav", "lecture-vi.m4a", "lecture-en.mp3", "mixed.m4a", "baseline-vi.mp3", "baseline-en.wav", "silence.wav", "silence.m4a", "noise.wav", "corrupt.mp3", "wrong-format.mp3", "empty.wav", "database.mp3", "hybrid/white.wav", "hybrid/brown.wav", "hybrid/tone.wav", "hybrid/chords.wav", "hybrid/clicks.wav", "hybrid/quiet-vi.wav", "hybrid/noisy-vi.wav", "hybrid/padded-vi.wav", "hybrid/switch-en-vi.wav"]) {
    const started = Date.now(), form = new FormData();
    form.append("file", new Blob([await readFile(path.join(fixtures, name))]), path.basename(name));
    const response = await fetch(origin + "/api/documents/upload", { method: "POST", headers: { origin }, body: form });
    const body = await response.json(), row = { name, http: response.status, body };
    if (response.status === 202) {
      const id = body.documentId;
      row.jobs = await waitJobs(id);
      row.document = db.prepare("SELECT status,textContent FROM Document WHERE id=?").get(id);
      row.chunks = db.prepare("SELECT content,sourceLabel FROM DocumentChunk WHERE documentId=? ORDER BY chunkIndex").all(id);
      const negative = /^(silence|noise|corrupt|database)|^hybrid\/(white|brown|tone|chords|clicks)\./.test(name);
      assert.equal(row.document.status, negative ? "FAILED" : "READY", JSON.stringify(row));
      if (negative) { assert.equal(row.document.textContent, null); assert.equal(row.chunks.length, 0); }
      else {
        assert.ok(row.chunks.length > 0);
        assert.ok(row.chunks.every(c => c.sourceLabel.includes("(mốc theo đoạn)")));
        assert.equal(row.jobs.find(j => j.type === "EMBED_DOCUMENT").status, "COMPLETED");
        const downloaded = await fetch(origin + `/api/documents/${id}/text?inline=1`).then(r => r.text());
        assert.equal(downloaded, row.document.textContent);
      }
    } else {
      assert.equal(response.status, name === "empty.wav" ? 413 : 415, JSON.stringify(body));
      assert.ok(["wrong-format.mp3", "empty.wav"].includes(name));
    }
    row.elapsedMs = Date.now() - started; rows.push(row);
    await writeFile(path.join(root, "results.json"), JSON.stringify(rows, null, 2));
    console.log(JSON.stringify({ name, http: row.http, status: row.document?.status, elapsedMs: row.elapsedMs, text: row.document?.textContent }));
  }
  const searches = [];
  for (const [name, query] of [["lecture-vi.mp3", "Khóa ngoại liên kết dữ liệu giữa các bảng"], ["lecture-en.mp3", "A primary key identifies each record"], ["baseline-vi.mp3", "mạng máy tính"]]) {
    const id = rows.find(row => row.name === name).body.documentId;
    const response = await fetch(origin + "/api/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, documentId: id, fileType: "AUDIO" }) });
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result)); assert.equal(result.status, "OK", JSON.stringify(result));
    assert.ok(result.results.some(r => r.documentId === id));
    searches.push({ name, query, result });
    console.log(`PASS real BGE search: ${name}`);
  }
  const id = rows.find(row => row.name === "short-vi.mp3").body.documentId;
  assert.equal((await fetch(origin + `/api/documents/${id}/reextract`, { method: "POST" })).status, 202);
  assert.ok((await waitJobs(id)).every(j => ["COMPLETED", "SKIPPED"].includes(j.status)));
  assert.equal(db.prepare("SELECT status FROM Document WHERE id=?").get(id).status, "READY");
  await writeFile(path.join(root, "search-results.json"), JSON.stringify(searches, null, 2));
  console.log("PASS audio upload flow: 26 fixtures, real Small + VAD + real BGE, saved transcript, negatives, retrieval, re-extraction");
} finally { db.close(); }
