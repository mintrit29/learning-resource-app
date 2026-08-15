import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { renderDocumentPreview } from "../src/lib/documents/render-document-preview.ts";

async function createDocx() {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>ScholarFlow DOCX embedded preview</w:t></w:r></w:p></w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

async function createPptx() {
  const zip = new JSZip();
  zip.file("ppt/presentation.xml", `<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`);
  zip.file("ppt/slides/slide1.xml", `<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:sp><p:spPr><a:xfrm><a:off x="914400" y="914400"/><a:ext cx="9144000" cy="1828800"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:rPr sz="2800"/><a:t>ScholarFlow PPTX embedded preview</a:t></a:r></a:p></p:txBody></p:sp></p:cSld></p:sld>`);
  zip.file("ppt/slides/slide2.xml", `<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:sp><p:spPr><a:xfrm><a:off x="914400" y="914400"/><a:ext cx="9144000" cy="1828800"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>Second slide</a:t></a:r></a:p></p:txBody></p:sp></p:cSld></p:sld>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

async function createOversizedPptx() {
  const zip = new JSZip();
  for (let index = 1; index <= 201; index += 1) {
    zip.file(`ppt/slides/slide${index}.xml`, `<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`);
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

async function createEpub() {
  const zip = new JSZip();
  zip.file("META-INF/container.xml", `<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>`);
  zip.file("OEBPS/content.opf", `<?xml version="1.0"?><package><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/><item id="chapter2" href="chapter2.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/><itemref idref="chapter2"/></spine></package>`);
  zip.file("OEBPS/chapter.xhtml", `<html><body><h1>ScholarFlow EPUB embedded preview</h1><p>Semantic learning resources.</p><script>globalThis.previewWasCompromised = true</script></body></html>`);
  zip.file("OEBPS/chapter2.xhtml", `<html><body><h1>Second chapter</h1><p>More learning resources.</p></body></html>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

const fixtures = [
  ["DOCX", await createDocx(), "ScholarFlow DOCX embedded preview", 1],
  ["PPTX", await createPptx(), "ScholarFlow PPTX embedded preview", 2],
  ["EPUB", await createEpub(), "ScholarFlow EPUB embedded preview", 2],
];

const fixtureDirectory = process.env.PREVIEW_FIXTURE_DIR
  ? path.resolve(process.env.PREVIEW_FIXTURE_DIR)
  : null;
if (fixtureDirectory) await mkdir(fixtureDirectory, { recursive: true });

for (const [fileType, buffer, expectedText, expectedItems] of fixtures) {
  const result = await renderDocumentPreview(buffer, fileType, `${fileType} test`);
  assert.match(result.html, new RegExp(expectedText));
  assert.equal(result.itemCount, expectedItems);
  assert.match(result.html, /id="preview-item-1" data-preview-item="1"/);
  if (expectedItems > 1) assert.match(result.html, /id="preview-item-2" data-preview-item="2"/);
  assert.doesNotMatch(result.html, /<script/i);
  assert.doesNotMatch(result.html, /previewWasCompromised/);
  if (fixtureDirectory) {
    await writeFile(path.join(fixtureDirectory, `preview-test.${fileType.toLowerCase()}`), buffer);
  }
  console.log(`PASS ${fileType}: in-app preview generated`);
}

await assert.rejects(
  renderDocumentPreview(await createOversizedPptx(), "PPTX", "Too many slides"),
  /quá 200 slide/,
);
