// Explicit opt-in: uploads fixtures only to the isolated desktop QA database.
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import Database from 'better-sqlite3';

const base = new URL(process.argv[2] || '');
assert.equal(base.hostname, '127.0.0.1');
const qaRoot = path.resolve('.tmp/mindmap-electron-qa');
const db = new Database(path.join(qaRoot, 'data/scholarflow.db'), { readonly: true, fileMustExist: true });
const fixtures = path.resolve('test-fixtures/scholarflow/06_mindmap_audio');
const report = [];
const cases = [
  ['06_mindmap_hien_dai.xmind', ['OSPF', 'Dijkstra', '3NF']],
  ['07_mindmap_legacy.xmind', ['OSPF', 'Dijkstra', '3NF']],
  ['02_audio_tieng_viet.mp3', ['tìm tài liệu học tập', 'mạng máy tính', 'cơ sở dữ liệu']],
  ['03_audio_tieng_anh.wav', ['learning resources', 'computer networks', 'databases']],
];
try {
  // Refuse writes until this server proves it serves an existing QA-only ID.
  const probe = db.prepare('SELECT id FROM Document ORDER BY id LIMIT 1').get();
  assert.ok(probe, 'Seed one fixture in the isolated QA app before running this test');
  const probeResponse = await fetch(new URL(`/api/documents/${encodeURIComponent(probe.id)}/file`, base), { signal: AbortSignal.timeout(15000) });
  assert.equal(probeResponse.status, 200, 'Wrong server: existing QA document is not accessible; no upload attempted');
  await probeResponse.arrayBuffer();
  for (const [filename, markers] of cases) {
    const started = Date.now();
    const form = new FormData();
    form.append('file', new Blob([await readFile(path.join(fixtures, filename))]), filename);
    const response = await fetch(new URL('/api/documents/upload', base), { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 202, await response.clone().text());
    const { documentId } = await response.json();
    // Check that this server really wrote into the QA DB before doing any more work.
    assert.ok(db.prepare('SELECT id FROM Document WHERE id=?').get(documentId), 'Wrong server: document not in isolated QA DB');
    let jobs;
    while (Date.now() - started < 240000) {
      jobs = db.prepare('SELECT type,status,errorMessage FROM AnalysisJob WHERE documentId=?').all(documentId);
      const core = jobs.filter(job => job.type !== 'ANALYZE_DOCUMENT');
      if (core.length >= 3 && core.every(job => ['COMPLETED', 'FAILED'].includes(job.status))) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    const document = db.prepare('SELECT textContent FROM Document WHERE id=?').get(documentId);
    const chunks = db.prepare('SELECT sourceLabel,length(embedding) AS vectorBytes FROM DocumentChunk WHERE documentId=?').all(documentId);
    const text = document.textContent || '';
    const found = markers.map(marker => ({ marker, found: text.toLowerCase().includes(marker.toLowerCase()) }));
    const search = await fetch(new URL('/api/search', base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: text.slice(0, 350), documentId }), signal: AbortSignal.timeout(60000) });
    const result = await search.json();
    const item = { filename, documentId, elapsedMs: Date.now() - started, text, markers: found, jobs, chunks, searchStatus: search.status, searchFound: result.results?.some(row => row.documentId === documentId) ?? false };
    report.push(item);
    await writeFile(path.join(qaRoot, 'mindmap-audio-live-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(item));
    assert.ok(jobs.filter(job => job.type !== 'ANALYZE_DOCUMENT').every(job => job.status === 'COMPLETED'), 'Core pipeline failed');
    assert.ok(text.length > 30 && chunks.length > 0 && chunks.every(chunk => chunk.vectorBytes === 4096), 'Missing text/chunks/1024-dimensional embeddings');
    assert.ok(item.searchFound, 'Uploaded document not searchable');
    assert.ok(found.every(item => item.found), 'Missing fixture content markers');
  }
} finally { db.close(); }
