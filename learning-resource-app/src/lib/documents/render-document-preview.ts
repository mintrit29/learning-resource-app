import path from "node:path";
import * as cheerio from "cheerio";
import JSZip from "jszip";
import mammoth from "mammoth";
import { mindmapStyles, renderXmindDiagram } from "./render-xmind.ts";

export type PreviewFileType = "DOCX" | "PPTX" | "EPUB" | "XMIND";

export type RenderedDocumentPreview = {
  html: string;
  itemCount: number;
};

const MAX_PREVIEW_ITEMS = 200;

const previewStyles = `
${mindmapStyles}
:root { color-scheme: light; font-family: "Segoe UI", Arial, sans-serif; }
* { box-sizing: border-box; }
html { min-height: 100%; background: #e9efed; }
body { min-height: 100%; margin: 0; color: #17211f; }
a { color: #087f70; }
img { max-width: 100%; height: auto; }
.preview-toolbar { position: sticky; z-index: 20; top: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid #d6e0dc; background: rgba(255,255,255,.96); padding: 10px 16px; color: #5f6f6a; font-size: 12px; backdrop-filter: blur(10px); }
.preview-toolbar strong { overflow: hidden; color: #17211f; text-overflow: ellipsis; white-space: nowrap; }
.preview-toolbar span { flex: 0 0 auto; }
.document-canvas { width: min(920px, calc(100% - 32px)); min-height: calc(100vh - 92px); margin: 18px auto; background: white; padding: clamp(24px, 6vw, 72px); box-shadow: 0 12px 34px rgba(23,33,31,.12); }
.document-canvas h1, .document-canvas h2, .document-canvas h3 { line-height: 1.25; }
.document-canvas p, .document-canvas li { line-height: 1.7; }
.document-canvas table { width: 100%; border-collapse: collapse; }
.document-canvas td, .document-canvas th { border: 1px solid #cfd9d6; padding: 8px; vertical-align: top; }
.document-canvas pre { overflow: auto; background: #f3f7f5; padding: 14px; white-space: pre-wrap; }
.epub-chapter + .epub-chapter { margin-top: 48px; border-top: 1px solid #d6e0dc; padding-top: 38px; }
.epub-chapter-label { margin: 0 0 22px; color: #087f70; font-size: 12px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
.slides-canvas { display: grid; gap: 28px; width: min(1040px, calc(100% - 28px)); margin: 18px auto 32px; }
.slide-card { display: grid; gap: 8px; }
.slide-label { margin: 0; color: #52615d; font-size: 12px; font-weight: 750; }
.ppt-slide { position: relative; width: 100%; aspect-ratio: var(--slide-ratio, 16 / 9); overflow: hidden; container-type: inline-size; border: 1px solid #cbd6d2; background: var(--slide-background, white); box-shadow: 0 12px 30px rgba(23,33,31,.14); }
.ppt-element { position: absolute; overflow: hidden; }
.ppt-text { display: flex; flex-direction: column; justify-content: center; padding: .35%; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.15; }
.ppt-text p { margin: 0 0 .3em; }
.ppt-image { object-fit: contain; }
.ppt-fallback { position: absolute; inset: 8%; display: grid; place-content: center; gap: 12px; padding: 5%; color: #24312e; font-size: clamp(14px, 2.6vw, 30px); text-align: center; white-space: pre-wrap; }
#matched-preview { scroll-margin-top: 76px; outline: 3px solid #0b8f7f; outline-offset: 4px; background: #dff7f1 !important; }
.empty-preview { display: grid; min-height: 55vh; place-content: center; padding: 32px; color: #5f6f6a; text-align: center; }
@media (max-width: 640px) {
  .preview-toolbar { align-items: flex-start; flex-direction: column; }
  .document-canvas { width: 100%; min-height: calc(100vh - 82px); margin: 0; padding: 22px 18px; box-shadow: none; }
  .slides-canvas { width: calc(100% - 16px); gap: 18px; margin: 8px auto 20px; }
  .ppt-text { font-size: 10px !important; }
}
`;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function htmlDocument(title: string, label: string, content: string, bodyClass = "") {
  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${previewStyles}</style>
</head>
<body class="${bodyClass}">
  <header class="preview-toolbar"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(label)}</span></header>
  ${content}
</body>
</html>`;
}

function normalizeMatchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function highlightPreviewMatch(html: string, matchText?: string) {
  const normalizedMatch = normalizeMatchText(matchText ?? "");
  if (!normalizedMatch) return html;
  const matchTokens = [...new Set(normalizedMatch.split(" ").filter((token) => token.length >= 3))];
  if (!matchTokens.length) return html;

  const $ = cheerio.load(html);
  let bestMatch = $("__scholarflow_no_match__");
  let bestScore = 0;
  if ($(".mindmap-tree").length) scoreCandidates(".mindmap-node");
  else scoreCandidates("p, h1, h2, h3, h4, h5, h6, li, td, th, tr, table, pre, .ppt-text, .ppt-fallback");
  function scoreCandidates(selector: string) { $(selector).each((_, element) => {
    const candidate = normalizeMatchText(`${$(element).attr("data-path") ?? ""} ${$(element).text()}`);
    if (!candidate) return;
    const score = matchTokens.reduce(
      (total, token) => total + (candidate.includes(token) ? Math.min(token.length, 12) : 0),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      bestMatch = $(element);
    }
  }); }

  if (!bestMatch.length || bestScore < 6) return html;
  bestMatch.attr("id", "matched-preview").addClass("matched-preview");
  return $.html();
}

function safeImageDataUrl(contentType: string, base64: string) {
  const normalized = contentType.toLowerCase();
  if (!["image/png", "image/jpeg", "image/gif", "image/webp"].includes(normalized)) return null;
  return `data:${normalized};base64,${base64}`;
}

function imageContentType(fileName: string, declaredType?: string) {
  const normalized = declaredType?.toLowerCase();
  if (normalized && ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(normalized)) {
    return normalized;
  }
  switch (path.posix.extname(fileName).toLowerCase()) {
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".gif": return "image/gif";
    case ".webp": return "image/webp";
    default: return null;
  }
}

function sanitizeFragment(value: string) {
  const $ = cheerio.load(value);
  $("script, iframe, frame, object, embed, form, input, button, textarea, select, meta, link, base, style, svg, math").remove();
  $("*").each((_, element) => {
    for (const attribute of Object.keys($(element).attr() ?? {})) {
      const normalized = attribute.toLowerCase();
      if (
        normalized.startsWith("on")
        || normalized === "style"
        || normalized === "srcset"
        || normalized === "formaction"
        || normalized === "xlink:href"
      ) {
        $(element).removeAttr(attribute);
      }
    }

    const href = $(element).attr("href");
    if (href && !href.startsWith("#")) $(element).removeAttr("href");
    const src = $(element).attr("src");
    if (src && !/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(src)) {
      $(element).removeAttr("src");
    }
  });
  return $("body").html() ?? "";
}

async function renderDocx(buffer: Buffer, title: string): Promise<RenderedDocumentPreview> {
  const result = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const content = await image.read("base64");
        const src = safeImageDataUrl(image.contentType, content);
        return src ? { src } : { src: "" };
      }),
    },
  );
  const content = sanitizeFragment(result.value);
  const body = content
    ? `<main class="document-canvas docx-document" id="preview-item-1" data-preview-item="1">${content}</main>`
    : `<main class="empty-preview">Không tìm thấy nội dung có thể hiển thị trong file DOCX.</main>`;
  return { html: htmlDocument(title, "Bản xem nhanh DOCX trong ScholarFlow", body), itemCount: content ? 1 : 0 };
}

function resolveArchivePath(baseFile: string, target: string) {
  const cleanTarget = target.split("#", 1)[0].split("?", 1)[0];
  let decoded = cleanTarget;
  try { decoded = decodeURIComponent(cleanTarget); } catch { /* Keep the original path. */ }
  return path.posix.normalize(path.posix.join(path.posix.dirname(baseFile), decoded));
}

async function renderEpub(buffer: Buffer, title: string, itemNumber?: number): Promise<RenderedDocumentPreview> {
  const zip = await JSZip.loadAsync(buffer);
  const containerXml = await zip.file("META-INF/container.xml")?.async("text");
  if (!containerXml) throw new Error("EPUB không có META-INF/container.xml");
  const container = cheerio.load(containerXml, { xmlMode: true });
  const opfPath = container("rootfile").attr("full-path");
  if (!opfPath) throw new Error("Không tìm thấy package document trong EPUB");
  const opfXml = await zip.file(opfPath)?.async("text");
  if (!opfXml) throw new Error("Không đọc được package document của EPUB");

  const opf = cheerio.load(opfXml, { xmlMode: true });
  const manifest = new Map<string, { href: string; mediaType?: string }>();
  opf("manifest item").each((_, element) => {
    const id = opf(element).attr("id");
    const href = opf(element).attr("href");
    if (id && href) manifest.set(id, { href, mediaType: opf(element).attr("media-type") });
  });

  const chapters: string[] = [];
  const opfDirectory = path.posix.dirname(opfPath);
  const spineIds: string[] = [];
  opf("spine itemref").each((_, element) => {
    const idref = opf(element).attr("idref");
    if (idref) spineIds.push(idref);
  });
  if (spineIds.length > MAX_PREVIEW_ITEMS) {
    throw new Error(`EPUB có quá ${MAX_PREVIEW_ITEMS} chương/phần, vượt giới hạn xem tạm.`);
  }

  if (itemNumber !== undefined && (itemNumber < 1 || itemNumber > spineIds.length)) {
    throw new Error("Chương/phần EPUB không tồn tại.");
  }
  const selectedSpineEntries = itemNumber === undefined
    ? spineIds.map((idref, index) => [index, idref] as const)
    : [[itemNumber - 1, spineIds[itemNumber - 1]] as const];

  for (const [index, idref] of selectedSpineEntries) {
    const item = manifest.get(idref);
    if (!item) continue;
    const chapterPath = path.posix.normalize(path.posix.join(opfDirectory, item.href));
    const chapterHtml = await zip.file(chapterPath)?.async("text");
    if (!chapterHtml) continue;
    const chapter = cheerio.load(chapterHtml);

    const images = chapter("img").toArray();
    for (const image of images) {
      const src = chapter(image).attr("src");
      if (!src || /^(?:data:|https?:|file:|javascript:)/i.test(src)) continue;
      const archivePath = resolveArchivePath(chapterPath, src);
      const archiveFile = zip.file(archivePath);
      const contentType = imageContentType(archivePath);
      if (!archiveFile || !contentType) {
        chapter(image).removeAttr("src");
        continue;
      }
      const dataUrl = safeImageDataUrl(contentType, await archiveFile.async("base64"));
      if (dataUrl) chapter(image).attr("src", dataUrl);
    }

    const heading = chapter("h1, h2, title").first().text().trim();
    const content = sanitizeFragment(chapter("body").html() ?? chapter.root().html() ?? "");
    if (!content.trim()) continue;
    chapters.push(`<section class="epub-chapter" id="preview-item-${index + 1}" data-preview-item="${index + 1}"><p class="epub-chapter-label">Chương ${index + 1}${heading ? ` · ${escapeHtml(heading)}` : ""}</p>${content}</section>`);
  }

  const body = chapters.length
    ? `<main class="document-canvas epub-document">${chapters.join("")}</main>`
    : `<main class="empty-preview">Không tìm thấy chương có thể hiển thị trong file EPUB.</main>`;
  return {
    html: htmlDocument(title, itemNumber === undefined ? `${chapters.length} chương · Bản xem nhanh EPUB` : `Phần ${itemNumber}/${spineIds.length} · Bản xem nhanh EPUB`, body),
    itemCount: itemNumber === undefined ? chapters.length : spineIds.length,
  };
}

type Position = { x: number; y: number; width: number; height: number };

function readPosition(node: ReturnType<cheerio.CheerioAPI>, slideWidth: number, slideHeight: number): Position | null {
  const transform = node.find("a\\:xfrm").first();
  const offset = transform.find("a\\:off").first();
  const extent = transform.find("a\\:ext").first();
  const x = Number(offset.attr("x"));
  const y = Number(offset.attr("y"));
  const width = Number(extent.attr("cx"));
  const height = Number(extent.attr("cy"));
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return {
    x: (x / slideWidth) * 100,
    y: (y / slideHeight) * 100,
    width: (width / slideWidth) * 100,
    height: (height / slideHeight) * 100,
  };
}

function positionStyle(position: Position) {
  return `left:${position.x.toFixed(3)}%;top:${position.y.toFixed(3)}%;width:${position.width.toFixed(3)}%;height:${position.height.toFixed(3)}%;`;
}

function readHexColor(node: ReturnType<cheerio.CheerioAPI>) {
  const color = node.find("a\\:srgbClr").first().attr("val");
  return color && /^[0-9a-f]{6}$/i.test(color) ? `#${color}` : null;
}

function slideRelationships(zip: JSZip, slidePath: string) {
  const relationshipPath = path.posix.join(
    path.posix.dirname(slidePath),
    "_rels",
    `${path.posix.basename(slidePath)}.rels`,
  );
  return zip.file(relationshipPath)?.async("text").then((xml) => {
    const relationships = new Map<string, string>();
    const $ = cheerio.load(xml, { xmlMode: true });
    $("Relationship").each((_, element) => {
      const id = $(element).attr("Id");
      const target = $(element).attr("Target");
      if (id && target && !/^(?:https?:|file:)/i.test(target)) {
        relationships.set(id, resolveArchivePath(slidePath, target));
      }
    });
    return relationships;
  }) ?? Promise.resolve(new Map<string, string>());
}

async function renderPptx(buffer: Buffer, title: string, itemNumber?: number): Promise<RenderedDocumentPreview> {
  const zip = await JSZip.loadAsync(buffer);
  const presentationXml = await zip.file("ppt/presentation.xml")?.async("text");
  let slideWidth = 12_192_000;
  let slideHeight = 6_858_000;
  if (presentationXml) {
    const presentation = cheerio.load(presentationXml, { xmlMode: true });
    const size = presentation("p\\:sldSz").first();
    slideWidth = Number(size.attr("cx")) || slideWidth;
    slideHeight = Number(size.attr("cy")) || slideHeight;
  }

  const slidePaths = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => Number(a.match(/slide(\d+)\.xml/i)?.[1] ?? 0) - Number(b.match(/slide(\d+)\.xml/i)?.[1] ?? 0));
  if (slidePaths.length > MAX_PREVIEW_ITEMS) {
    throw new Error(`PPTX có quá ${MAX_PREVIEW_ITEMS} slide, vượt giới hạn xem tạm.`);
  }
  if (itemNumber !== undefined && (itemNumber < 1 || itemNumber > slidePaths.length)) {
    throw new Error("Slide không tồn tại.");
  }
  const selectedSlideEntries = itemNumber === undefined
    ? slidePaths.map((slidePath, index) => [index, slidePath] as const)
    : [[itemNumber - 1, slidePaths[itemNumber - 1]] as const];
  const slides: string[] = [];

  for (const [index, slidePath] of selectedSlideEntries) {
    const xml = await zip.file(slidePath)?.async("text");
    if (!xml) continue;
    const $ = cheerio.load(xml, { xmlMode: true });
    const relationships = await slideRelationships(zip, slidePath);
    const elements: string[] = [];
    const fallbackText: string[] = [];

    $("p\\:sp").each((_, shape) => {
      const node = $(shape);
      const paragraphs = node.find("a\\:p").toArray().map((paragraph) => {
        const text = $(paragraph).find("a\\:t").toArray().map((part) => $(part).text()).join("");
        return text.trim();
      }).filter(Boolean);
      if (!paragraphs.length) return;
      const position = readPosition(node, slideWidth, slideHeight);
      if (!position) {
        fallbackText.push(...paragraphs);
        return;
      }
      const fontSize = Math.max(9, Math.min(54, Number(node.find("a\\:rPr[sz], a\\:defRPr[sz], a\\:endParaRPr[sz]").first().attr("sz")) / 100 || 18));
      const responsiveFontSize = Math.max(.7, (fontSize * 12_700 / slideWidth) * 100);
      const color = readHexColor(node.find("p\\:txBody").first()) ?? "#17211f";
      const background = readHexColor(node.find("p\\:spPr").first());
      const paragraphHtml = paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
      elements.push(`<div class="ppt-element ppt-text" style="${positionStyle(position)}font-size:clamp(7px,${responsiveFontSize.toFixed(3)}cqw,${fontSize}px);color:${color};${background ? `background:${background};` : ""}">${paragraphHtml}</div>`);
    });

    const pictures = $("p\\:pic").toArray();
    for (const picture of pictures) {
      const node = $(picture);
      const relationId = node.find("a\\:blip").first().attr("r:embed");
      const archivePath = relationId ? relationships.get(relationId) : null;
      const archiveFile = archivePath ? zip.file(archivePath) : null;
      const contentType = archivePath ? imageContentType(archivePath) : null;
      const position = readPosition(node, slideWidth, slideHeight);
      if (!archiveFile || !contentType || !position) continue;
      const dataUrl = safeImageDataUrl(contentType, await archiveFile.async("base64"));
      if (dataUrl) elements.push(`<img class="ppt-element ppt-image" style="${positionStyle(position)}" src="${dataUrl}" alt="" />`);
    }

    if (!elements.length) {
      const allText = $("a\\:t").toArray().map((part) => $(part).text().trim()).filter(Boolean);
      fallbackText.push(...allText);
    }
    const uniqueFallback = [...new Set(fallbackText)];
    const fallback = uniqueFallback.length
      ? `<div class="ppt-fallback">${uniqueFallback.map(escapeHtml).join("\n")}</div>`
      : "";
    const background = readHexColor($("p\\:bg").first()) ?? "#ffffff";
    slides.push(`<article class="slide-card" id="preview-item-${index + 1}" data-preview-item="${index + 1}"><p class="slide-label">Slide ${index + 1}</p><div class="ppt-slide" style="--slide-ratio:${slideWidth} / ${slideHeight};--slide-background:${background};">${elements.join("")}${fallback}</div></article>`);
  }

  const body = slides.length
    ? `<main class="slides-canvas">${slides.join("")}</main>`
    : `<main class="empty-preview">Không tìm thấy slide có thể hiển thị trong file PPTX.</main>`;
  return {
    html: htmlDocument(title, itemNumber === undefined ? `${slides.length} slide · Bản xem nhanh PPTX` : `Slide ${itemNumber}/${slidePaths.length} · Bản xem nhanh PPTX`, body, "pptx-preview"),
    itemCount: itemNumber === undefined ? slides.length : slidePaths.length,
  };
}

export async function renderDocumentPreview(
  buffer: Buffer,
  fileType: PreviewFileType,
  title: string,
  itemNumber?: number,
  matchText?: string,
): Promise<RenderedDocumentPreview> {
  let preview: RenderedDocumentPreview;
  switch (fileType) {
    case "XMIND": {
      const diagram = await renderXmindDiagram(buffer, itemNumber);
      preview = { html: htmlDocument(title, "XMind · Sơ đồ nhánh (bố cục tự sắp xếp)", diagram.body), itemCount: diagram.itemCount };
      break;
    }
    case "DOCX": preview = await renderDocx(buffer, title); break;
    case "PPTX": preview = await renderPptx(buffer, title, itemNumber); break;
    case "EPUB": preview = await renderEpub(buffer, title, itemNumber); break;
  }
  return { ...preview, html: highlightPreviewMatch(preview.html, matchText) };
}
