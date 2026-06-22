import assert from "node:assert/strict";
import JSZip from "jszip";
import { extractDocumentText } from "../src/lib/documents/extract-text.ts";

function createPdf(text) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = `BT /F1 16 Tf 72 720 Td (${text}) Tj ET`;
  objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf);
}

async function createDocx() {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>ScholarFlow DOCX extraction test</w:t></w:r></w:p></w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

async function createPptx() {
  const zip = new JSZip();
  zip.file("ppt/slides/slide1.xml", `<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><a:t>ScholarFlow PPTX extraction test</a:t></p:cSld></p:sld>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

async function createEpub() {
  const zip = new JSZip();
  zip.file("META-INF/container.xml", `<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>`);
  zip.file("OEBPS/content.opf", `<?xml version="1.0"?><package><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>`);
  zip.file("OEBPS/chapter.xhtml", `<html><body><h1>ScholarFlow EPUB extraction test</h1><p>Semantic learning resources.</p></body></html>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

const fixtures = [
  ["pdf", createPdf("ScholarFlow PDF extraction test"), "ScholarFlow PDF extraction test", "Trang 1"],
  ["docx", await createDocx(), "ScholarFlow DOCX extraction test", "Nội dung tài liệu"],
  ["pptx", await createPptx(), "ScholarFlow PPTX extraction test", "Slide 1"],
  ["epub", await createEpub(), "ScholarFlow EPUB extraction test", "Chương 1: ScholarFlow EPUB extraction test"],
];

for (const [extension, buffer, expected, expectedLocation] of fixtures) {
  const result = await extractDocumentText(buffer, extension);
  assert.match(result.text, new RegExp(expected));
  assert.equal(result.sections[0]?.sourceLabel, expectedLocation);
  console.log(`PASS ${extension.toUpperCase()}: ${result.text.length} characters`);
}
