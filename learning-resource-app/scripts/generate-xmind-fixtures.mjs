import JSZip from 'jszip';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'test-fixtures/scholarflow/06_mindmap_audio');
await mkdir(out, { recursive: true });
let id = 0;
const node = (title, notes = '', children = []) => ({ id: `sf-${++id}`, title, notes: { plain: { content: notes } }, children: { attached: children } });
const sheets = [
  { id: 'sheet-network', title: 'Mạng máy tính', rootTopic: node('Ôn tập mạng', '', [
    node('Định tuyến OSPF', 'Trạng thái liên kết. Chọn tuyến theo tổng chi phí. SF-XM-OSPF-42', [node('Dijkstra', 'Shortest path first. Không dùng cho cạnh trọng số âm.')]),
    node('Mô hình TCP/IP', 'Bốn tầng: ứng dụng, vận chuyển, Internet và truy cập mạng.'),
    node('Bảo mật mạng', 'Mã hóa và tường lửa. Encryption and firewall.'),
    node('Địa chỉ IPv4', 'Mặt nạ mạng con. Subnet mask and addressing.'),
  ]) },
  { id: 'sheet-database', title: 'Cơ sở dữ liệu', rootTopic: node('Ôn tập dữ liệu', '', [
    node('Chuẩn hóa 3NF', 'Loại bỏ phụ thuộc bắc cầu. SF-XM-3NF-73'),
    node('Giao dịch ACID', 'Tính nguyên tử, nhất quán, cô lập, bền vững. Atomicity, consistency, isolation, durability.'),
    node('Chỉ mục B-tree', 'Tăng tốc truy vấn theo khoảng.'),
    node('Khóa ngoại', 'Bảo đảm toàn vẹn tham chiếu.'),
  ]) },
];
sheets[0].rootTopic.children.detached = [node('Nhánh rời', 'Nội dung nhánh rời vẫn phải được đọc. SF-XM-DETACHED-19')];
sheets[0].rootTopic.children.attached[0].labels = ['Định tuyến', 'Tiếng Việt'];
const modern = new JSZip();
modern.file('content.json', JSON.stringify(sheets));
modern.file('metadata.json', JSON.stringify({ creator: { name: 'ScholarFlow fixture', version: '1' } }));
modern.file('manifest.json', JSON.stringify({ 'file-entries': { 'content.json': {}, 'metadata.json': {} } }));
await writeFile(path.join(out, '06_mindmap_hien_dai.xmind'), await modern.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function xmlNode(n) {
  return `<topic id="${n.id}"><title>${esc(n.title)}</title><notes><plain>${esc(n.notes.plain.content)}</plain></notes><labels>${(n.labels || []).map(x => `<label>${esc(x)}</label>`).join('')}</labels><children>${Object.entries(n.children).map(([kind, children]) => `<topics type="${kind}">${children.map(xmlNode).join('')}</topics>`).join('')}</children></topic>`;
}
const legacy = new JSZip();
legacy.file('content.xml', `<?xml version="1.0" encoding="UTF-8"?><xmap-content xmlns="urn:xmind:xmap:xmlns:content:2.0" version="2.0">${sheets.map(s => `<sheet id="${s.id}"><title>${esc(s.title)}</title>${xmlNode(s.rootTopic)}</sheet>`).join('')}</xmap-content>`);
legacy.file('META-INF/manifest.xml', '<?xml version="1.0"?><manifest xmlns="urn:xmind:xmap:xmlns:manifest:1.0"><file-entry full-path="content.xml" media-type="text/xml"/></manifest>');
await writeFile(path.join(out, '07_mindmap_legacy.xmind'), await legacy.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
const bad = new JSZip().file('readme.txt', 'Not an XMind workbook');
await writeFile(path.join(out, '08_xmind_hong_KHONG_UPLOAD_THANH_CONG.xmind'), await bad.generateAsync({ type: 'nodebuffer' }));
console.log(out);
