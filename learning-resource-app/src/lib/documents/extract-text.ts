import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  checkDependencies,
  chunkDocumentAsync,
  convertAsync,
  convertFileAsync,
  type Chunk,
} from "docling.rs";

const MIN_EXTRACTED_TEXT_LENGTH = 20;
const DOCLING_OCR_LANG = process.env.DOCLING_OCR_LANG ?? "ch";
const DOCLING_FORCE_FULL_PAGE_OCR = process.env.DOCLING_FORCE_FULL_PAGE_OCR === "1";
const MAX_EMBEDDED_IMAGES = Number(process.env.DOCLING_MAX_EMBEDDED_IMAGES ?? 100);

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

type DoclingReference = { $ref?: string };

type DoclingProvenance = {
  page_no?: number;
  pageNumber?: number;
};

type DoclingImage = {
  mimetype?: string;
  uri?: string;
  size?: { width?: number; height?: number };
};

type DoclingItem = {
  self_ref?: string;
  label?: string;
  text?: string;
  orig?: string;
  prov?: DoclingProvenance[];
  image?: DoclingImage;
  captions?: DoclingReference[];
};

type DoclingDocument = {
  texts?: DoclingItem[];
  pictures?: DoclingItem[];
  tables?: DoclingItem[];
  key_value_items?: DoclingItem[];
  form_items?: DoclingItem[];
  pages?: Record<string, unknown>;
};

function normalizeExtractedText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/<!--\s*image\s*-->/gi, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function requireDoclingRuntime() {
  const dependencies = checkDependencies();
  if (dependencies.ready && dependencies.ocr) return;

  const missing = dependencies.missing.length
    ? dependencies.missing.join(", ")
    : "OCR models";
  throw new Error(
    `Docling chưa sẵn sàng (${missing}). Hãy cài bộ runtime Docling rồi thử lại.`,
  );
}

function parseDoclingDocument(content: string) {
  try {
    return JSON.parse(content) as DoclingDocument;
  } catch {
    throw new Error("Docling trả về cấu trúc tài liệu không hợp lệ.");
  }
}

function allDocumentItems(document: DoclingDocument) {
  return [
    ...(document.texts ?? []),
    ...(document.pictures ?? []),
    ...(document.tables ?? []),
    ...(document.key_value_items ?? []),
    ...(document.form_items ?? []),
  ];
}

function pageNumberFromItem(item: DoclingItem | undefined) {
  const provenance = item?.prov?.[0];
  const pageNumber = provenance?.page_no ?? provenance?.pageNumber;
  return Number.isInteger(pageNumber) && Number(pageNumber) > 0
    ? Number(pageNumber)
    : undefined;
}

function defaultSourceLabel(extension: SupportedExtension, pageNumber?: number) {
  if (extension === "pdf" && pageNumber) return `Trang ${pageNumber}`;
  if (extension === "pptx") return "Nội dung trình chiếu";
  if (extension === "epub") return "Nội dung sách";
  return "Nội dung tài liệu";
}

function sectionsFromDoclingChunks(
  chunks: Chunk[],
  document: DoclingDocument,
  extension: SupportedExtension,
) {
  const itemsByReference = new Map(
    allDocumentItems(document).flatMap((item) => item.self_ref ? [[item.self_ref, item] as const] : []),
  );

  return chunks.flatMap((chunk) => {
    const text = normalizeExtractedText(chunk.contextualized || chunk.text);
    if (!text) return [];

    const pageNumber = chunk.docItems
      .map((reference) => pageNumberFromItem(itemsByReference.get(reference)))
      .find((value) => value !== undefined);
    const heading = chunk.headings?.map(normalizeExtractedText).filter(Boolean).at(-1);

    return [{
      text,
      pageNumber,
      sourceLabel: pageNumber
        ? defaultSourceLabel(extension, pageNumber)
        : heading || defaultSourceLabel(extension),
    }];
  });
}

function decodeDataImage(image: DoclingImage | undefined) {
  const match = image?.uri?.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match) return null;
  return {
    mimeType: image?.mimetype || match[1],
    data: Buffer.from(match[2], "base64"),
  };
}

function imageFormatFromMimeType(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpeg";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("tiff")) return "tiff";
  if (normalized.includes("bmp")) return "bmp";
  return "png";
}

async function extractEmbeddedImageSections(
  document: DoclingDocument,
  extension: SupportedExtension,
) {
  if (extension === "pdf") return [];

  const sections: ExtractedSection[] = [];
  const seenImages = new Set<string>();
  const pictures = (document.pictures ?? []).slice(0, Math.max(0, MAX_EMBEDDED_IMAGES));

  for (const [index, picture] of pictures.entries()) {
    const decoded = decodeDataImage(picture.image);
    if (!decoded || decoded.data.length === 0) continue;

    const fingerprint = decoded.data.subarray(0, 64).toString("base64") + decoded.data.length;
    if (seenImages.has(fingerprint)) continue;
    seenImages.add(fingerprint);

    const format = imageFormatFromMimeType(decoded.mimeType);
    const result = await convertAsync(
      { name: `embedded-${index + 1}.${format}`, data: decoded.data, format: "image" },
      {
        strict: true,
        to: "markdown",
        imageMode: "placeholder",
        ocrLang: DOCLING_OCR_LANG,
      },
    );
    const text = normalizeExtractedText(result.content);
    if (result.status === "failure" || text.length < MIN_EXTRACTED_TEXT_LENGTH) continue;

    const pageNumber = pageNumberFromItem(picture);
    sections.push({
      text,
      pageNumber,
      sourceLabel: pageNumber
        ? `${defaultSourceLabel(extension, pageNumber)} · Hình ${index + 1} (Docling OCR)`
        : `Hình ${index + 1} (Docling OCR)`,
    });
  }

  return sections;
}

function fallbackSectionsFromDocument(
  document: DoclingDocument,
  extension: SupportedExtension,
) {
  return (document.texts ?? []).flatMap((item) => {
    const text = normalizeExtractedText(item.text || item.orig || "");
    if (!text) return [];
    const pageNumber = pageNumberFromItem(item);
    return [{ text, pageNumber, sourceLabel: defaultSourceLabel(extension, pageNumber) }];
  });
}

export async function extractDocumentText(
  buffer: Buffer,
  extension: SupportedExtension,
): Promise<ExtractionResult> {
  requireDoclingRuntime();

  const workDirectory = await mkdtemp(path.join(os.tmpdir(), "scholarflow-docling-"));
  const documentPath = path.join(workDirectory, `document.${extension}`);
  let result: Awaited<ReturnType<typeof convertFileAsync>>;
  try {
    await writeFile(documentPath, buffer);
    result = await convertFileAsync(documentPath, {
      strict: true,
      to: "json",
      imageMode: "embedded",
      fetchImages: extension === "epub",
      ocrLang: DOCLING_OCR_LANG,
      forceFullPageOcr: extension === "pdf" && DOCLING_FORCE_FULL_PAGE_OCR,
    });
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
  if (result.status === "failure") {
    throw new Error(`Docling không thể xử lý tài liệu ${extension.toUpperCase()}.`);
  }

  const document = parseDoclingDocument(result.content);
  const chunks = await chunkDocumentAsync(result.content, { chunker: "hierarchical" });
  const structuredSections = sectionsFromDoclingChunks(chunks, document, extension);
  const textSections = structuredSections.length
    ? structuredSections
    : fallbackSectionsFromDocument(document, extension);
  const imageSections = await extractEmbeddedImageSections(document, extension);
  const sections = [...textSections, ...imageSections];
  const text = normalizeExtractedText(sections.map((section) => section.text).join("\n\n"));
  const pageCount = Math.max(
    Object.keys(document.pages ?? {}).length,
    ...sections.map((section) => section.pageNumber ?? 0),
  );

  return {
    text,
    pageCount: pageCount || undefined,
    sections,
  };
}
