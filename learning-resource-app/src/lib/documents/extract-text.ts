import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { extractPagesMarkdown } from "@firecrawl/pdf-inspector";
import * as cheerio from "cheerio";
import { checkDependencies, convertAsync, Pipeline } from "docling.rs";
import JSZip from "jszip";
import mammoth from "mammoth";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";

const execFile = promisify(execFileCallback);
const MIN_EXTRACTED_TEXT_LENGTH = 20;
const MIN_PAGE_TEXT_LENGTH_BEFORE_OCR = Number(process.env.OCR_PAGE_TEXT_THRESHOLD ?? 80);
const OCR_DPI = Number(process.env.OCR_DPI ?? 180);
const OCR_MAX_PAGES = Number(process.env.OCR_MAX_PAGES ?? 20);
const OCR_LANGS = process.env.OCR_LANGS ?? "vie+eng";
const DOCLING_OCR_LANG = process.env.DOCLING_OCR_LANG ?? "ch";

const globalForDocling = globalThis as typeof globalThis & {
  scholarFlowDoclingPdfPipeline?: Pipeline;
};

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

function markdownSections(markdown: string, defaultLabel: string): ExtractedSection[] {
  const sections: ExtractedSection[] = [];
  let currentLabel = defaultLabel;
  let currentLines: string[] = [];

  function flushSection() {
    const text = normalizeExtractedText(currentLines.join("\n"));
    if (text) sections.push({ text, sourceLabel: currentLabel });
    currentLines = [];
  }

  for (const line of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*$/);
    if (heading) {
      flushSection();
      currentLabel = normalizeExtractedText(heading[1]);
    }
    currentLines.push(line);
  }
  flushSection();

  return sections;
}

async function extractDeclarativeFormatWithDocling(
  buffer: Buffer,
  extension: Exclude<SupportedExtension, "pdf">,
  defaultLabel: string,
): Promise<ExtractionResult | null> {
  try {
    const result = await convertAsync(
      { name: `document.${extension}`, data: buffer, format: extension },
      { strict: true, to: "markdown", imageMode: "placeholder" },
    );
    const text = normalizeExtractedText(result.content);
    if (result.status === "failure" || text.length < MIN_EXTRACTED_TEXT_LENGTH) return null;
    const sections = markdownSections(text, defaultLabel);
    return { text, sections: sections.length ? sections : [{ text, sourceLabel: defaultLabel }] };
  } catch {
    return null;
  }
}

async function extractPdfWithDocling(
  buffer: Buffer,
  pageCount: number,
): Promise<ExtractionResult | null> {
  const dependencies = checkDependencies();
  if (!dependencies.ready || !dependencies.ocr) return null;

  try {
    const pipeline = globalForDocling.scholarFlowDoclingPdfPipeline
      ?? new Pipeline({ strict: true, ocrLang: DOCLING_OCR_LANG });
    globalForDocling.scholarFlowDoclingPdfPipeline = pipeline;
    const result = await pipeline.convertAsync(
      { name: "document.pdf", data: buffer, format: "pdf" },
      { to: "markdown", imageMode: "placeholder" },
    );
    const text = normalizeExtractedText(result.content);
    if (result.status === "failure" || text.length < MIN_EXTRACTED_TEXT_LENGTH) return null;
    return {
      text,
      pageCount,
      sections: [{ text, sourceLabel: "Nội dung PDF (Docling OCR)" }],
    };
  } catch {
    return null;
  }
}

async function runPdfOcr(
  buffer: Buffer,
  pageCount: number,
  pageNumbers?: number[],
): Promise<ExtractionResult> {
  if (process.env.OCR_ENABLED === "0") {
    throw new Error("PDF này cần OCR, nhưng OCR đang bị tắt bằng OCR_ENABLED=0.");
  }

  const maxPages = Math.max(1, Math.min(pageCount, OCR_MAX_PAGES));
  const pagesToOcr = (pageNumbers?.length
    ? pageNumbers
    : Array.from({ length: maxPages }, (_, index) => index + 1)
  ).filter((pageNumber) => pageNumber >= 1 && pageNumber <= maxPages);

  if (!pagesToOcr.length) return { text: "", pageCount, sections: [] };

  const workDir = await mkdtemp(path.join(os.tmpdir(), "scholarflow-ocr-"));
  const pdfPath = path.join(workDir, "source.pdf");
  const imagePrefix = path.join(workDir, "page");

  try {
    await writeFile(pdfPath, buffer);
    await execFile("pdftoppm", [
      "-f",
      "1",
      "-l",
      String(Math.max(...pagesToOcr)),
      "-r",
      String(OCR_DPI),
      "-png",
      pdfPath,
      imagePrefix,
    ]);

    const images = (await readdir(workDir))
      .filter((fileName) => {
        const pageNumber = Number(fileName.match(/page-(\d+)\.png/i)?.[1] ?? 0);
        return /^page-\d+\.png$/i.test(fileName) && pagesToOcr.includes(pageNumber);
      })
      .sort((a, b) => {
        const aNumber = Number(a.match(/page-(\d+)\.png/i)?.[1] ?? 0);
        const bNumber = Number(b.match(/page-(\d+)\.png/i)?.[1] ?? 0);
        return aNumber - bNumber;
      });

    const sections: ExtractedSection[] = [];
    for (const image of images) {
      const pageNumber = Number(image.match(/page-(\d+)\.png/i)?.[1] ?? sections.length + 1);
      const { stdout } = await execFile("tesseract", [
        path.join(workDir, image),
        "stdout",
        "-l",
        OCR_LANGS,
        "--psm",
        "6",
      ]);
      const text = normalizeExtractedText(stdout);
      if (text) {
        sections.push({
          text,
          pageNumber,
          sourceLabel: `Trang ${pageNumber} (OCR)`,
        });
      }
    }

    const text = normalizeExtractedText(sections.map((section) => section.text).join("\n\n"));
    if (!pageNumbers?.length && text.length < MIN_EXTRACTED_TEXT_LENGTH) {
      throw new Error("OCR đã chạy nhưng không đọc được đủ chữ từ PDF scan/ảnh.");
    }

    return { text, pageCount, sections };
  } catch (error) {
    const message = error instanceof Error ? error.message : "OCR PDF thất bại";
    throw new Error(
      `PDF này cần OCR nhưng OCR chưa chạy được. Hãy kiểm tra Poppler/Tesseract trong môi trường chạy. Chi tiết: ${message}`,
    );
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function extractPdfLegacy(buffer: Buffer): Promise<ExtractionResult> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const result = await extractPdfText(pdf);
  const pageSections = result.text.map((text, index) => ({
    text: normalizeExtractedText(text),
    pageNumber: index + 1,
    sourceLabel: `Trang ${index + 1}`,
  }));
  const sections = pageSections.filter((section) => section.text.length > 0);
  const text = normalizeExtractedText(sections.map((section) => section.text).join("\n\n"));
  if (text.length < MIN_EXTRACTED_TEXT_LENGTH && result.totalPages > 0) {
    return runPdfOcr(buffer, result.totalPages);
  }

  const pagesNeedingOcr = pageSections
    .filter((section) => section.pageNumber <= OCR_MAX_PAGES)
    .filter((section) => section.text.length < MIN_PAGE_TEXT_LENGTH_BEFORE_OCR)
    .map((section) => section.pageNumber);

  if (pagesNeedingOcr.length > 0) {
    try {
      const ocrResult = await runPdfOcr(buffer, result.totalPages, pagesNeedingOcr);
      const ocrSectionsByPage = new Map(
        ocrResult.sections.map((section) => [section.pageNumber, section]),
      );
      const mergedSections = pageSections
        .map((section) => ocrSectionsByPage.get(section.pageNumber) ?? section)
        .filter((section) => section.text.length > 0);

      return {
        text: normalizeExtractedText(mergedSections.map((section) => section.text).join("\n\n")),
        pageCount: result.totalPages,
        sections: mergedSections,
      };
    } catch {
      return {
        text,
        pageCount: result.totalPages,
        sections,
      };
    }
  }

  return {
    text,
    pageCount: result.totalPages,
    sections,
  };
}

async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const result = extractPagesMarkdown(buffer);
    const sections = result.pages
      .map((page) => ({
        text: normalizeExtractedText(page.markdown),
        pageNumber: page.page + 1,
        sourceLabel: `Trang ${page.page + 1}`,
      }))
      .filter((section) => section.text.length > 0);
    const text = normalizeExtractedText(sections.map((section) => section.text).join("\n\n"));

    if (result.pagesNeedingOcr.length > 0) {
      const doclingResult = await extractPdfWithDocling(buffer, result.pages.length);
      if (doclingResult) return doclingResult;
      return extractPdfLegacy(buffer);
    }

    if (text.length >= MIN_EXTRACTED_TEXT_LENGTH) {
      return { text, pageCount: result.pages.length, sections };
    }
  } catch {
    // Some malformed-but-readable PDFs are handled better by unpdf.
  }

  return extractPdfLegacy(buffer);
}

async function extractDocxLegacy(buffer: Buffer): Promise<ExtractionResult> {
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

async function extractDocx(buffer: Buffer): Promise<ExtractionResult> {
  return await extractDeclarativeFormatWithDocling(buffer, "docx", "Nội dung tài liệu")
    ?? extractDocxLegacy(buffer);
}

async function extractPptxLegacy(buffer: Buffer): Promise<ExtractionResult> {
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

async function extractPptx(buffer: Buffer): Promise<ExtractionResult> {
  const legacyResult = await extractPptxLegacy(buffer);
  if (legacyResult.text.length >= MIN_EXTRACTED_TEXT_LENGTH) return legacyResult;
  return await extractDeclarativeFormatWithDocling(buffer, "pptx", "Nội dung trình chiếu")
    ?? legacyResult;
}

async function extractEpubLegacy(buffer: Buffer): Promise<ExtractionResult> {
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

async function extractEpub(buffer: Buffer): Promise<ExtractionResult> {
  const doclingResult = await extractDeclarativeFormatWithDocling(buffer, "epub", "Nội dung sách");
  if (doclingResult) {
    return {
      ...doclingResult,
      sections: doclingResult.sections.map((section, index) => ({
        ...section,
        sourceLabel: `Chương ${index + 1}: ${section.sourceLabel}`,
      })),
    };
  }
  return extractEpubLegacy(buffer);
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
