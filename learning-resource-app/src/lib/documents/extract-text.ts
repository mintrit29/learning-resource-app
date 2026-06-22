import path from "node:path";
import * as cheerio from "cheerio";
import JSZip from "jszip";
import mammoth from "mammoth";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";

export type SupportedExtension = "pdf" | "pptx" | "docx" | "epub";

export type ExtractionResult = {
  text: string;
  pageCount?: number;
  sections: ExtractedSection[];
};

export type ExtractedSection = {
  text: string;
  pageNumber?: number;
  sourceLabel: string;
};

function normalizeExtractedText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const result = await extractPdfText(pdf);
  const sections = result.text
    .map((text, index) => ({
      text: normalizeExtractedText(text),
      pageNumber: index + 1,
      sourceLabel: `Trang ${index + 1}`,
    }))
    .filter((section) => section.text.length > 0);
  return {
    text: normalizeExtractedText(sections.map((section) => section.text).join("\n\n")),
    pageCount: result.totalPages,
    sections,
  };
}

async function extractDocx(buffer: Buffer): Promise<ExtractionResult> {
  const result = await mammoth.convertToHtml({ buffer });
  const $ = cheerio.load(result.value);
  const sections: ExtractedSection[] = [];
  let currentLabel = "Nội dung tài liệu";
  let currentParts: string[] = [];

  function flushSection() {
    const text = normalizeExtractedText(currentParts.join("\n"));
    if (text) sections.push({ text, sourceLabel: currentLabel });
    currentParts = [];
  }

  $("body").children().each((_, element) => {
    const tagName = element.tagName?.toLowerCase();
    const text = $(element).text().trim();
    if (!text) return;
    if (/^h[1-6]$/.test(tagName)) {
      flushSection();
      currentLabel = text;
      currentParts.push(text);
    } else {
      currentParts.push(text);
    }
  });
  flushSection();

  const text = normalizeExtractedText(sections.map((section) => section.text).join("\n\n"));
  return { text, sections: sections.length ? sections : [{ text, sourceLabel: currentLabel }] };
}

async function extractPptx(buffer: Buffer): Promise<ExtractionResult> {
  const zip = await JSZip.loadAsync(buffer);
  const slides = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const aNumber = Number(a.match(/slide(\d+)\.xml/i)?.[1] ?? 0);
      const bNumber = Number(b.match(/slide(\d+)\.xml/i)?.[1] ?? 0);
      return aNumber - bNumber;
    });

  const sections = await Promise.all(
    slides.map(async (slideName, index) => {
      const xml = await zip.file(slideName)?.async("text");
      if (!xml) return null;
      const $ = cheerio.load(xml, { xmlMode: true });
      const fragments: string[] = [];
      $("a\\:t").each((_, element) => {
        const value = $(element).text().trim();
        if (value) fragments.push(value);
      });
      const text = normalizeExtractedText(fragments.join("\n"));
      return text ? { text, pageNumber: index + 1, sourceLabel: `Slide ${index + 1}` } : null;
    }),
  );
  const validSections = sections.filter((section) => section !== null);

  return {
    text: normalizeExtractedText(validSections.map((section) => section.text).join("\n\n")),
    pageCount: slides.length,
    sections: validSections,
  };
}

async function extractEpub(buffer: Buffer): Promise<ExtractionResult> {
  const zip = await JSZip.loadAsync(buffer);
  const containerXml = await zip.file("META-INF/container.xml")?.async("text");
  if (!containerXml) throw new Error("EPUB không có META-INF/container.xml");

  const container = cheerio.load(containerXml, { xmlMode: true });
  const opfPath = container("rootfile").attr("full-path");
  if (!opfPath) throw new Error("Không tìm thấy package document trong EPUB");

  const opfXml = await zip.file(opfPath)?.async("text");
  if (!opfXml) throw new Error("Không đọc được package document của EPUB");

  const opf = cheerio.load(opfXml, { xmlMode: true });
  const manifest = new Map<string, string>();
  opf("manifest item").each((_, element) => {
    const id = opf(element).attr("id");
    const href = opf(element).attr("href");
    if (id && href) manifest.set(id, href);
  });

  const opfDirectory = path.posix.dirname(opfPath);
  const contentPaths: string[] = [];
  opf("spine itemref").each((_, element) => {
    const idref = opf(element).attr("idref");
    const href = idref ? manifest.get(idref) : undefined;
    if (href) contentPaths.push(path.posix.normalize(path.posix.join(opfDirectory, href)));
  });

  const sections = await Promise.all(
    contentPaths.map(async (contentPath, index) => {
      const html = await zip.file(contentPath)?.async("text");
      if (!html) return null;
      const $ = cheerio.load(html);
      $("script, style, nav").remove();
      const heading = $("h1, h2, title").first().text().trim();
      const text = normalizeExtractedText($("body").text());
      return text
        ? {
            text,
            sourceLabel: heading ? `Chương ${index + 1}: ${heading}` : `Chương ${index + 1}`,
          }
        : null;
    }),
  );
  const validSections = sections.filter((section) => section !== null);

  return {
    text: normalizeExtractedText(validSections.map((section) => section.text).join("\n\n")),
    pageCount: contentPaths.length,
    sections: validSections,
  };
}

export async function extractDocumentText(
  buffer: Buffer,
  extension: SupportedExtension,
): Promise<ExtractionResult> {
  switch (extension) {
    case "pdf":
      return extractPdf(buffer);
    case "docx":
      return extractDocx(buffer);
    case "pptx":
      return extractPptx(buffer);
    case "epub":
      return extractEpub(buffer);
  }
}
