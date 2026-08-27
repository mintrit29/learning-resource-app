import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = path.join(projectRoot, "test-fixtures", "scholarflow", "06_mindmap_audio");
process.env.DOCLING_RS_HOME ||= path.join(projectRoot, ".docling-runtime");
process.env.PDFIUM_DYNAMIC_LIB_PATH ||= path.join(projectRoot, ".docling-runtime", "pdfium", "lib");

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/transcribe") {
    response.writeHead(404).end();
    return;
  }
  for await (const chunk of request) {
    assert.ok(chunk.length > 0);
  }
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({
    model: "test/whisper",
    language: "vi",
    text: "Ứng dụng giúp tìm tài liệu học tập về mạng máy tính và cơ sở dữ liệu.",
    chunks: [
      { text: "Ứng dụng giúp tìm tài liệu học tập", start: 0, end: 2.4 },
      { text: "về mạng máy tính và cơ sở dữ liệu", start: 2.4, end: 4.8 },
    ],
    duration_seconds: 5,
    elapsed_ms: 10,
  }));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
process.env.EMBEDDING_SERVICE_URL = `http://127.0.0.1:${address.port}`;

try {
  const { extractDocumentText } = await import("../src/lib/documents/extract-text.ts");
  const mindMap = await extractDocumentText(
    await readFile(path.join(fixtureRoot, "01_mindmap_mang_may_tinh.png")),
    "png",
  );
  assert.match(mindMap.text, /MẠNG MÁY TÍNH/i);
  assert.match(mindMap.text, /OSPF/i);
  assert.equal(mindMap.sections[0]?.sourceLabel, "Sơ đồ tư duy hoặc ảnh · OCR Việt–Anh");

  const audio = await extractDocumentText(
    await readFile(path.join(fixtureRoot, "02_audio_tieng_viet.mp3")),
    "mp3",
  );
  assert.match(audio.text, /mạng máy tính/i);
  assert.equal(audio.sections.length, 2);
  assert.equal(audio.sections[0]?.sourceLabel, "Bản ghi âm · 00:00–00:02");
  console.log("PASS media extraction: mind map OCR and timestamped audio transcript sections");
} finally {
  server.close();
  const { shutdownVietnameseOcr } = await import("../src/lib/documents/vietnamese-ocr.ts");
  await shutdownVietnameseOcr();
}
