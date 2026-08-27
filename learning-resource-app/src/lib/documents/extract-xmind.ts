import JSZip from "jszip";
import * as cheerio from "cheerio";
import { Readable } from "node:stream";
import { createXmindImageReader, type XmindImage } from "./xmind-images.ts";

// XMind's public JSON schema and legacy XML SDK describe the same topic tree.
// Read only content; never unpack archive paths, follow links, or execute notes.
const MAX_CONTENT_BYTES = 8 * 1024 * 1024;
const MAX_NODES = 5000;
type Topic = { title: string; notes: string; labels: string[]; children: Topic[]; detached?: boolean; images?: XmindImage[] };
type Sheet = { title: string; root: Topic };
type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue => value && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : {};
const clean = (value: unknown): string => typeof value === "string" ? value.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim() : "";

async function readContent(entry: JSZip.JSZipObject) {
  const stream = new Readable().wrap(entry.nodeStream());
  const parts: Buffer[] = [];
  let bytes = 0;
  try {
    for await (const chunk of stream) {
      bytes += chunk.length;
      if (bytes > MAX_CONTENT_BYTES) throw new Error("Nội dung XMind vượt giới hạn 8 MB sau giải nén.");
      parts.push(Buffer.from(chunk));
    }
  } finally {
    stream.destroy();
  }
  return Buffer.concat(parts).toString("utf8");
}

export async function readXmind(buffer: Buffer): Promise<Sheet[]> {
  if (buffer.length > 25 * 1024 * 1024) throw new Error("XMind phải nhỏ hơn 25 MB.");
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(buffer); }
  catch { throw new Error("Không đọc được XMind: file hỏng hoặc được mã hóa/mật khẩu."); }
  if (Object.keys(zip.files).length > 5000) throw new Error("XMind chứa quá nhiều thành phần.");
  let nodes = 0;
  function guard(depth: number) {
    if (++nodes > MAX_NODES || depth > 64) throw new Error("XMind vượt giới hạn 5.000 nhánh hoặc 64 cấp.");
  }
  let sheets: Sheet[];
  const json = zip.file("content.json");
  const xml = zip.file("content.xml");
  if (json) {
    let content: unknown;
    try { content = JSON.parse(await readContent(json)); }
    catch (error) {
      if (error instanceof SyntaxError) throw new Error("Nội dung JSON trong XMind không hợp lệ.");
      throw error;
    }
    if (!Array.isArray(content) || content.length === 0 || content.length > 200) throw new Error("XMind phải có từ 1 đến 200 trang sơ đồ.");
    function topic(value: unknown, depth: number): Topic {
      guard(depth);
      const node = object(value);
      if (!Object.keys(node).length) throw new Error("Cấu trúc nhánh XMind không hợp lệ.");
      const notes = object(node.notes);
      const html = clean(object(notes.html).content);
      return {
        title: clean(node.title),
        notes: clean(object(notes.plain).content) || (html ? cheerio.load(html).text().trim() : ""),
        labels: (Array.isArray(node.labels) ? node.labels : [node.labels]).map(clean).filter(Boolean),
        images: [...new Set([clean(object(node.image).src), ...(html ? cheerio.load(html)("img").toArray().map(img => clean(cheerio.load(html)(img).attr("src"))) : [])].filter(Boolean))].map(source => ({ source })),
        children: Object.entries(object(node.children)).flatMap(([kind, group]) => {
          if (!Array.isArray(group)) throw new Error("Danh sách nhánh XMind không hợp lệ.");
          return group.map((child) => ({ ...topic(child, depth + 1), detached: kind === "detached" }));
        }),
      };
    }
    sheets = content.map((value, index) => {
      const sheet = object(value);
      return { title: clean(sheet.title) || `Sơ đồ ${index + 1}`, root: topic(sheet.rootTopic, 0) };
    });
  } else if (xml) {
    const content = await readContent(xml);
    if (/<!DOCTYPE|<!ENTITY/i.test(content)) throw new Error("XMind XML có khai báo thực thể không được hỗ trợ.");
    const $ = cheerio.load(content, { xmlMode: true });
    // Match local names to accept both default and explicit namespace prefixes.
    const children = (node: ReturnType<typeof $>, name: string) => node.children().filter((_, item) => item.type === "tag" && item.name.split(":").at(-1) === name);
    const root = $.root().children().first();
    const entries = children(root, "sheet");
    if (entries.length === 0 || entries.length > 200) throw new Error("XMind XML phải có từ 1 đến 200 trang sơ đồ.");
    function topic(node: ReturnType<typeof $>, depth: number): Topic {
      guard(depth);
      if (!node.length) throw new Error("XMind XML thiếu nhánh gốc.");
      const notes = children(node, "notes");
      return {
        title: children(node, "title").text().trim(),
        notes: (children(notes, "plain").text() || children(notes, "html").text()).trim(),
        labels: children(children(node, "labels"), "label").toArray().map((label) => $(label).text().trim()).filter(Boolean),
        images: [...new Set([...children(node, "img").toArray(), ...children(notes, "html").find("*").filter((_, item) => item.type === "tag" && item.name.split(":").at(-1) === "img").toArray()].map(image => clean($(image).attr("xhtml:src") || $(image).attr("src"))).filter(Boolean))].map(source => ({ source })),
        children: children(children(node, "children"), "topics").toArray().flatMap((group) => children($(group), "topic").toArray().map((child) => ({ ...topic($(child), depth + 1), detached: $(group).attr("type") === "detached" }))),
      };
    }
    sheets = entries.toArray().map((entry, index) => ({ title: children($(entry), "title").text().trim() || `Sơ đồ ${index + 1}`, root: topic(children($(entry), "topic").first(), 0) }));
  } else {
    throw new Error("File không phải XMind được hỗ trợ: thiếu content.json hoặc content.xml.");
  }
  const readImage = createXmindImageReader(zip);
  async function resolveImages(node: Topic): Promise<void> {
    for (let i = 0; i < (node.images?.length ?? 0); i++) node.images![i] = await readImage(node.images![i].source);
    for (const child of node.children) await resolveImages(child);
  }
  for (const sheet of sheets) await resolveImages(sheet.root);
  return sheets;
}

export async function extractXmind(buffer: Buffer) {
  const sheets = await readXmind(buffer);
  const sections: { text: string; pageNumber: number; sourceLabel: string }[] = [];
  const warnings: string[] = [];
  const imageTextCache = new Map<string, { text: string; warning?: string }>();
  let outputBytes = 0;
  for (const [index, sheet] of sheets.entries()) {
    async function walk(node: Topic, ancestors: string[]) {
      const path = [...ancestors, node.title || "(Nhánh không tên)"];
      if (node.title || node.notes || node.labels.length) {
        const text = [path.join(" > "), node.notes, node.labels.length ? `Nhãn: ${node.labels.join(", ")}` : ""].filter(Boolean).join("\n");
        outputBytes += Buffer.byteLength(text);
        if (outputBytes > MAX_CONTENT_BYTES) throw new Error("Nội dung cây XMind vượt giới hạn 8 MB.");
        sections.push({ text, pageNumber: index + 1, sourceLabel: `Sơ đồ ${index + 1} · ${path.join(" > ")}` });
      }
      for (const [imageIndex, image] of (node.images ?? []).entries()) {
        const label = `Sơ đồ ${index + 1} · ${path.join(" > ")} · Ảnh ${imageIndex + 1}`;
        if (!image.dataUrl) { warnings.push(`${label}: ${image.warning}`); continue; }
        let result = imageTextCache.get(image.source);
        if (!result) {
          const { recognizeXmindImage } = await import("./xmind-image-ocr.ts");
          result = await recognizeXmindImage(Buffer.from(image.dataUrl.split(",")[1], "base64"));
          imageTextCache.set(image.source, result);
        }
        if (result.warning) warnings.push(`${label}: ${result.warning}`);
        if (result.text) {
          const text = `${path.join(" > ")}\n${result.text}`;
          outputBytes += Buffer.byteLength(text);
          if (outputBytes > MAX_CONTENT_BYTES) throw new Error("Nội dung cây XMind vượt giới hạn 8 MB.");
          sections.push({ text, pageNumber: index + 1, sourceLabel: `${label} (OCR Việt–Anh)` });
        }
      }
      for (const child of node.children) await walk(child, path);
    }
    await walk(sheet.root, [sheet.title]);
  }
  if (!sections.length) throw new Error(`XMind không có chữ đọc được. ${warnings[0] ?? "Hãy kiểm tra nhánh và ảnh nhúng."}`);
  return { text: sections.map((section) => section.text).join("\n\n"), pageCount: sheets.length, sections, warnings };
}
