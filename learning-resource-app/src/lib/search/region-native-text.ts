export type RegionBounds = { left: number; top: number; right: number; bottom: number };

export function containsCharacterCenter(region: RegionBounds, rect: RegionBounds) {
  const x = (rect.left + rect.right) / 2;
  const y = (rect.top + rect.bottom) / 2;
  return rect.right > rect.left && rect.bottom > rect.top && x >= region.left && x <= region.right && y >= region.top && y <= region.bottom;
}

// Read only characters inside the selection, never whole unselected note lines.
export function readRegionText(document: Document, region: RegionBounds) {
  const root = document.querySelector(".mindmap-sheet") ?? document.body;
  const walker = document.createTreeWalker(root, 4 /* SHOW_TEXT */);
  const parts: string[] = [];
  let node = walker.nextNode();
  let length = 0;
  while (node && length < 1500) {
    const text = node.textContent ?? "";
    if (text.trim() && !node.parentElement?.closest("figcaption, [data-no-region-text]")) {
      const range = document.createRange();
      range.selectNodeContents(node);
      const intersects = [...range.getClientRects()].some(r => r.left < region.right && r.right > region.left && r.top < region.bottom && r.bottom > region.top);
      if (intersects) {
        let selected = "";
        for (let index = 0; index < text.length && length < 1500;) {
          const count = (text.codePointAt(index) ?? 0) > 0xffff ? 2 : 1;
          range.setStart(node, index);
          range.setEnd(node, index + count);
          if ([...range.getClientRects()].some(r => containsCharacterCenter(region, r))) {
            selected += text.slice(index, index + count);
            length += count;
          }
          index += count;
        }
        if (selected.trim()) parts.push(selected.trim());
      }
    }
    node = walker.nextNode();
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}
