import JSZip from 'jszip';
import { createCanvas } from '@napi-rs/canvas';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const out = path.resolve('test-fixtures/scholarflow/06_mindmap_audio');
await mkdir(out, { recursive: true });
function picture(lines, blank = false) {
  const canvas = createCanvas(1400, 300);
  const c = canvas.getContext('2d');
  c.fillStyle = '#fff'; c.fillRect(0, 0, 1400, 300);
  c.fillStyle = '#152b2a'; c.font = '42px Arial';
  lines.forEach((line, i) => c.fillText(line, 45, 75 + i * 75));
  if (blank) { c.fillStyle = '#0b8f7f'; c.beginPath(); c.arc(500, 150, 70, 0, Math.PI * 2); c.fill(); }
  return canvas.toBuffer('image/png');
}
const images = {
  'vi.png': picture(['Định tuyến OSPF dùng trạng thái liên kết.', 'Mạng máy tính và cơ sở dữ liệu.']),
  'en.png': picture(['Database transactions preserve data integrity.', 'Atomicity consistency isolation durability.']),
  'formula.png': picture(['T(n) = O((V + E) log V)', 'Dijkstra shortest path algorithm']),
  'blank.png': picture([], true),
  'broken.png': Buffer.from('This is not a PNG'),
};
const topics = Object.keys(images).map((name, index) => ({
  id: `image-${index}`, title: ['Ảnh tiếng Việt', 'Ảnh tiếng Anh', 'Ảnh công thức', 'Ảnh không chữ', 'Ảnh hỏng'][index],
  image: { src: `xap:resources/${name}`, width: 1400, height: 300 },
}));
topics.push({ id:'missing', title:'Ảnh thiếu', image:{src:'xap:resources/missing.png'} });
topics.push({ id:'external', title:'Ảnh ngoài không tự tải', image:{src:'https://example.invalid/private.png'} });
const sheets = [{id:'images-1', title:'Kiểm tra ảnh nhúng', rootTopic:{id:'root-images', title:'Học liệu có ảnh', children:{attached:topics}}},
  {id:'images-2', title:'Sơ đồ thứ hai', rootTopic:{id:'root-two', title:'Nhánh gốc thứ hai', children:{attached:[{id:'reuse',title:'Ảnh Việt được dùng lại',image:{src:'xap:resources/vi.png'}}]}}}];
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function xmlTopic(n) { return `<topic id="${n.id}"><title>${esc(n.title)}</title>${n.image ? `<xhtml:img xhtml:src="${esc(n.image.src)}" svg:width="1400" svg:height="300"/>` : ''}${n.children ? `<children><topics type="attached">${n.children.attached.map(xmlTopic).join('')}</topics></children>` : ''}</topic>`; }
for (const [name, legacy] of [['09_xmind_anh_nhung.xmind',false],['10_xmind_anh_nhung_legacy.xmind',true]]) {
  const zip = new JSZip();
  Object.entries(images).forEach(([name,data])=>zip.file(`resources/${name}`,data));
  if (legacy) zip.file('content.xml', `<?xml version="1.0"?><xmap-content xmlns="urn:xmind:xmap:xmlns:content:2.0" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:svg="http://www.w3.org/2000/svg">${sheets.map(s=>`<sheet id="${s.id}"><title>${esc(s.title)}</title>${xmlTopic(s.rootTopic)}</sheet>`).join('')}</xmap-content>`);
  else zip.file('content.json',JSON.stringify(sheets));
  await writeFile(path.join(out,name),await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
}
console.log('Created JSON/XML XMind fixtures: embedded VI/EN/formula/blank/corrupt/missing/external/reused images');
