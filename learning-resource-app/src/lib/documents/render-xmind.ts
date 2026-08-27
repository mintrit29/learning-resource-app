import { readXmind } from "./extract-xmind.ts";

const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

// Layout is deliberately generated from the topic hierarchy, not arbitrary
// archive HTML/styles. Native text remains available for exact region search.
export async function renderXmindDiagram(buffer: Buffer, itemNumber?: number) {
  const sheets = await readXmind(buffer);
  if (itemNumber !== undefined && (!Number.isInteger(itemNumber) || itemNumber < 1 || itemNumber > sheets.length)) {
    throw new Error("Trang sơ đồ không tồn tại.");
  }
  type Topic = (typeof sheets)[number]["root"];
  function branch(node: Topic, ancestors: string[]): string {
    const title = node.title || "(Nhánh không tên)";
    const lineage = [...ancestors, title];
    const attached = node.children.filter(child => !child.detached);
    const pictures = (node.images ?? []).map((image, index) => image.dataUrl
      ? `<figure class="mindmap-picture"><img class="mindmap-image" src="${image.dataUrl}" width="${image.width}" height="${image.height}" alt="Ảnh ${index + 1} của nhánh ${escape(title)}" /><figcaption>Ảnh ${index + 1} · Khoanh ảnh để đọc chữ</figcaption></figure>`
      : `<p class="mindmap-image-warning" data-no-region-text="true">Ảnh ${index + 1}: ${escape(image.warning ?? "Không đọc được ảnh")}</p>`).join("");
    return `<li><article class="mindmap-node" data-path="${escape(lineage.join(" > "))}"><h3>${escape(title)}</h3>${node.notes ? `<p>${escape(node.notes)}</p>` : ""}${node.labels.length ? `<p class="mindmap-labels">Nhãn: ${escape(node.labels.join(", "))}</p>` : ""}${pictures}</article>${attached.length ? `<ul>${attached.map(child => branch(child, lineage)).join("")}</ul>` : ""}</li>`;
  }
  const body = sheets.map((sheet, index) => {
    if (itemNumber !== undefined && itemNumber !== index + 1) return "";
    const detached: string[] = [];
    function findDetached(node: Topic, ancestors: string[]) {
      const path = [...ancestors, node.title || "(Nhánh không tên)"];
      for (const child of node.children) {
        if (child.detached) detached.push(`<ul class="mindmap-tree mindmap-detached">${branch(child, path)}</ul>`);
        findDetached(child, path);
      }
    }
    findDetached(sheet.root, [sheet.title]);
    return `<section class="mindmap-sheet" data-sheet="${index + 1}"><h2>${escape(sheet.title)}</h2><ul class="mindmap-tree">${branch(sheet.root, [sheet.title])}</ul>${detached.length ? `<div class="mindmap-detached-group"><h2>Nhánh rời</h2>${detached.join("")}</div>` : ""}</section>`;
  }).join("");
  return { body, itemCount: sheets.length };
}

export const mindmapStyles = `
.mindmap-sheet { padding: 28px; width: max-content; min-width: 100%; background: #f6faf9; }
.mindmap-sheet > h2 { margin: 0 0 24px; font-size: 20px; color: #076e61; }
.mindmap-tree, .mindmap-tree ul { list-style: none; margin: 0; padding: 0; }
.mindmap-tree { width: max-content; }
.mindmap-tree li { display: flex; align-items: center; position: relative; padding: 12px 0; }
.mindmap-tree ul { margin-left: 42px; position: relative; }
.mindmap-tree ul::before { content: ''; position: absolute; left: -42px; top: 50%; width: 21px; border-top: 2px solid #69a99e; }
.mindmap-tree ul > li::before { content: ''; position: absolute; left: -21px; width: 21px; top: 0; bottom: 0; border-left: 2px solid #69a99e; }
.mindmap-tree ul > li::after { content: ''; position: absolute; left: -21px; width: 21px; top: 50%; border-top: 2px solid #69a99e; }
.mindmap-tree ul > li:first-child::before { top: 50%; }
.mindmap-tree ul > li:last-child::before { bottom: 50%; }
.mindmap-node { flex: 0 0 240px; width: 240px; padding: 16px; border: 2px solid #9bcfc4; border-radius: 14px; background: white; box-shadow: 0 3px 10px #153e3010; overflow-wrap: anywhere; }
.mindmap-node h3 { font-size: 18px; line-height: 1.4; margin: 0; color: #133e35; }
.mindmap-node p { font-size: 15px; line-height: 1.5; margin: 10px 0 0; white-space: pre-wrap; }
.mindmap-node .mindmap-labels { color: #386d62; font-size: 13px; }
.mindmap-picture { margin: 12px 0 0; }
.mindmap-image { display: block; width: 100%; height: auto; object-fit: contain; background: white; }
.mindmap-picture figcaption, .mindmap-image-warning { font-size: 11px !important; color: #71603c; }
.mindmap-tree > li > .mindmap-node { background: #d9f3ec; border-color: #0b8f7f; }
.mindmap-detached-group { margin-top: 28px; border-top: 1px dashed #9bcfc4; padding-top: 16px; }
`;
