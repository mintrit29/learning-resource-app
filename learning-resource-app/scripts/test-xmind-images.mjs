import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { createCanvas } from '@napi-rs/canvas';
import { readXmind, extractXmind } from '../src/lib/documents/extract-xmind.ts';
import { renderDocumentPreview } from '../src/lib/documents/render-document-preview.ts';
import { xmindResourcePath, rasterInfo, createXmindImageReader } from '../src/lib/documents/xmind-images.ts';
import { shutdownVietnameseOcr } from '../src/lib/documents/vietnamese-ocr.ts';
process.env.DOCLING_RS_HOME ||= path.resolve('.docling-runtime');
const base = path.resolve('test-fixtures/scholarflow/06_mindmap_audio');
try {
  const outputs=[];
  for(const name of ['09_xmind_anh_nhung.xmind','10_xmind_anh_nhung_legacy.xmind']) {
    const buffer=await readFile(path.join(base,name));
    const sheets=await readXmind(buffer);
    assert.equal(sheets[0].root.children.filter(n=>n.images[0].dataUrl).length,4);
    assert.equal(sheets[0].root.children.filter(n=>n.images[0].warning).length,3);
    const preview=await renderDocumentPreview(buffer,'XMIND',name);
    assert.equal((preview.html.match(/class="mindmap-image"/g)||[]).length,5);
    assert.ok(!preview.html.includes('src="https:'));
    assert.ok(preview.html.includes('Ảnh hỏng'));
    const result=await extractXmind(buffer);
    // Measured baseline: the current OCR can lose the accent in "tuyến".
    // Keep this narrow known allowance; do not silently normalize all Vietnamese accents.
    assert.match(result.text,/Định tuy[ếê]n OSPF/);
    for(const marker of ['trạng thái liên kết','Mạng máy tính','cơ sở dữ liệu','Database transactions','data integrity','Dijkstra','log V']) assert.ok(result.text.includes(marker),`${name}: ${marker}\n${result.text}`);
    const ocr=result.sections.filter(s=>s.sourceLabel.includes('(OCR'));
    assert.equal(ocr.length,4,'VI, EN, formula, reused VI; blank does not generate text');
    assert.ok(ocr.some(s=>s.pageNumber===2 && s.sourceLabel.includes('Ảnh Việt được dùng lại')));
    assert.ok(result.warnings.length>=4,'Blank, corrupt, missing and external reported without losing native text');
    assert.ok(!result.text.includes('example.invalid'),'Warnings are not indexed as document content');
    outputs.push(result);
  }
  assert.deepEqual(outputs[0],outputs[1]);
  for(const src of ['../secret.png','xap:resources/../secret.png','xap:resources/%2e%2e/secret.png','file:///C:/secret.png','https://example.com/x.png','xap:resources/a\\b.png']) assert.equal(xmindResourcePath(src),null,src);
  assert.equal(xmindResourcePath('xap:resources/a%20b.png'),'resources/a b.png');
  const bomb=Buffer.alloc(24); Buffer.from([137,80,78,71,13,10,26,10]).copy(bomb); bomb.writeUInt32BE(9000,16); bomb.writeUInt32BE(9000,20);
  assert.equal(rasterInfo(bomb).width,9000);
  const zip=new JSZip().file('resources/bomb.png',bomb).file('resources/huge.png',Buffer.alloc(8*1024*1024+1));
  const reader=createXmindImageReader(zip);
  assert.match((await reader('xap:resources/bomb.png')).warning,/16 triệu/);
  assert.match((await reader('xap:resources/huge.png')).warning,/8 MB/);
  const canvas=createCanvas(40,30); canvas.getContext('2d').fillRect(0,0,40,30);
  const formats=new JSZip();
  for(const mime of ['image/png','image/jpeg','image/webp']) {
    const name=`resources/${mime.split('/')[1]}`;
    formats.file(name,canvas.toBuffer(mime));
    const parsed=await createXmindImageReader(formats)(`xap:${name}`);
    assert.equal(parsed.width,40); assert.equal(parsed.height,30);
    assert.ok(parsed.dataUrl.startsWith(`data:${mime};`));
  }
  formats.file('resources/vector.svg','<svg onload="alert(1)"/>');
  assert.ok((await createXmindImageReader(formats)('xap:resources/vector.svg')).warning);
  const repeated=createXmindImageReader(formats);
  for(let i=0;i<100;i++) assert.ok((await repeated('xap:resources/png')).dataUrl);
  assert.match((await repeated('xap:resources/png')).warning,/100 ảnh/);
  const htmlZip=await JSZip.loadAsync(await readFile(path.join(base,'09_xmind_anh_nhung.xmind')));
  htmlZip.file('content.json',JSON.stringify([{rootTopic:{title:'Notes',notes:{html:{content:'<p>Chữ gốc</p><img src="xap:resources/vi.png">'}}}}]));
  const htmlSheets=await readXmind(await htmlZip.generateAsync({type:'nodebuffer'}));
  assert.equal(htmlSheets[0].root.notes,'Chữ gốc');
  assert.ok(htmlSheets[0].root.images[0].dataUrl);
  console.log('PASS embedded XMind images: JSON/XML, real VI/EN/formula OCR, branch/page attribution, preview, blank/corrupt/missing/external, path and decompression guards');
} finally { await shutdownVietnameseOcr(); }
