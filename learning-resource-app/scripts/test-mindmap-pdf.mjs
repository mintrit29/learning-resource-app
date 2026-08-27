import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.DOCLING_RS_HOME ||= path.join(projectRoot, '.docling-runtime');
process.env.PDFIUM_DYNAMIC_LIB_PATH ||= path.join(process.env.DOCLING_RS_HOME, 'pdfium', 'lib');
const { extractDocumentText } = await import('../src/lib/documents/extract-text.ts');
const { shutdownVietnameseOcr } = await import('../src/lib/documents/vietnamese-ocr.ts');
const base = new URL('../test-fixtures/scholarflow/06_mindmap_audio/', import.meta.url);
const expected = [
  ['MẠNG MÁY TÍNH', 'Định tuyến OSPF', 'Trạng thái liên kết', 'Chọn tuyến theo tổng chi phí', 'Mô hình TCP/IP', 'Bốn tầng giao thức', 'Ứng dụng, vận chuyển, Internet, mạng', 'Bảo mật mạng', 'Mã hóa và tường lửa', 'Encryption and firewall', 'Địa chỉ IPv4', 'Mặt nạ mạng con', 'Subnet mask and addressing'],
  ['CƠ SỞ DỮ LIỆU', 'Chuẩn hóa 3NF', 'Loại phụ thuộc bắc cầu', 'Third normal form', 'Giao dịch ACID', 'Tính nguyên tử và nhất quán', 'Atomicity and consistency', 'Chỉ mục B-tree', 'Tăng tốc truy vấn', 'Index range scan', 'Khóa ngoại', 'Toàn vẹn tham chiếu', 'Foreign key constraint'],
];
const normalize = s => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
const report = [];
try {
  for (const name of ['04_mindmap_text.pdf', '05_mindmap_scan.pdf']) {
    const buffer = await readFile(new URL(name, base));
    const task = getDocument({ data: new Uint8Array(buffer), useSystemFonts: true });
    const pdf = await task.promise;
    for (let i = 1; i <= 2; i++) {
      const page = await pdf.getPage(i);
      const layer = (await page.getTextContent()).items.map(x => x.str || '').join('');
      assert.equal(layer.length > 0, name.includes('_text'), 'Scan must have no text layer');
    }
    await task.destroy();
    const started = Date.now();
    const result = await extractDocumentText(buffer, 'pdf');
    const checks = expected.flatMap((phrases, index) => {
      const pageText = normalize(result.sections.filter(s => s.pageNumber === index + 1).map(s => s.text).join(' '));
      return phrases.map(phrase => ({ page: index + 1, phrase, found: pageText.includes(normalize(phrase)) }));
    });
    const entry = { name, elapsedMs: Date.now() - started, pageCount: result.pageCount, checks, sections: result.sections };
    report.push(entry);
    console.log(`${name}: ${checks.filter(c => c.found).length}/${checks.length} exact phrase checks; ${entry.elapsedMs}ms`);
  }
} finally {
  await shutdownVietnameseOcr();
  await mkdir(new URL('../.tmp/', import.meta.url), { recursive: true });
  await writeFile(new URL('../.tmp/mindmap-pdf-report.json', import.meta.url), JSON.stringify(report, null, 2));
}
for (const entry of report) {
  assert.equal(entry.pageCount, 2);
  if (entry.name.includes('_text')) {
    assert.ok(entry.checks.every(c => c.found), `${entry.name} missing: ${JSON.stringify(entry.checks.filter(c => !c.found))}`);
  } else {
    // Measured Tesseract baseline: two phrases have accent mistakes; do not
    // claim exact transcription, and fail if coverage regresses further.
    const knownAccentErrors = new Set(['Chọn tuyến theo tổng chi phí', 'Ứng dụng, vận chuyển, Internet, mạng']);
    assert.ok(entry.checks.filter(c => !c.found).every(c => knownAccentErrors.has(c.phrase)), 'New OCR omissions beyond the documented baseline');
    assert.ok(entry.sections.every(s => s.sourceLabel.includes('OCR')));
  }
}
assert.equal(report.length, 2);
console.log('PASS native completeness + scan baseline; inspect report for exact OCR errors (not a 100% OCR claim).');
