import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { extractXmind } from "./extract-xmind.ts";
import {
  checkDependencies,
  chunkDocumentAsync,
  convertFileAsync,
  type Chunk,
} from "docling.rs";
import { recognizeVietnameseImageDetailed } from "./vietnamese-ocr.ts";
import { extractScannedPdfSections } from "./pdf-scan-ocr.ts";
import { extractPdfEmbeddedImages } from "./pdf-embedded-images.ts";
import {
  analyzeVisualOcrImage,
  chooseVisualOcrRoute,
} from "./visual-ocr-routing.ts";
import {
  formatTranscriptTimestamp,
  transcribeAudio,
  type SupportedAudioExtension,
} from "./transcribe-audio.ts";

const MIN_EXTRACTED_TEXT_LENGTH = 20;
const DOCLING_OCR_LANG = process.env.DOCLING_OCR_LANG ?? "ch";
const DOCLING_FORCE_FULL_PAGE_OCR = process.env.DOCLING_FORCE_FULL_PAGE_OCR === "1";
const MAX_EMBEDDED_IMAGES = Number(process.env.DOCLING_MAX_EMBEDDED_IMAGES ?? 100);

export type SupportedImageExtension = "png" | "jpg" | "jpeg" | "webp";
export type SupportedExtension = "pdf" | "pptx" | "docx" | "epub" | "xmind" | SupportedImageExtension | SupportedAudioExtension;
type DoclingExtension = Exclude<SupportedExtension, SupportedImageExtension | SupportedAudioExtension | "xmind">;

export type ExtractionResult = {
  warnings?: string[];
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

function defaultSourceLabel(extension: DoclingExtension, pageNumber?: number) {
  if (extension === "pdf" && pageNumber) return `Trang ${pageNumber}`;
  if (extension === "pptx") return "Nội dung trình chiếu";
  if (extension === "epub") return "Nội dung sách";
  return "Nội dung tài liệu";
}

function sectionsFromDoclingChunks(
  chunks: Chunk[],
  document: DoclingDocument,
  extension: DoclingExtension,
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

async function extractEmbeddedImageSections(
  document: DoclingDocument,
  extension: DoclingExtension,
) {
  const sections: ExtractedSection[] = [];
  const seenImages = new Set<string>();
  const pictures = (document.pictures ?? []).slice(0, Math.max(0, MAX_EMBEDDED_IMAGES));

  for (const [index, picture] of pictures.entries()) {
    const decoded = decodeDataImage(picture.image);
    if (!decoded || decoded.data.length === 0) continue;

    const fingerprint = decoded.data.subarray(0, 64).toString("base64") + decoded.data.length;
    if (seenImages.has(fingerprint)) continue;
    seenImages.add(fingerprint);

    const recognized = await recognizeVietnameseImageDetailed(decoded.data);
    const text = normalizeExtractedText(recognized.text);
    const route = chooseVisualOcrRoute(text, await analyzeVisualOcrImage(decoded.data));
    const meaningfulCharacters = text.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
    const usableFormula = route === "formula" && meaningfulCharacters >= 2;
    if (
      route === "reject"
      || (route !== "formula" && recognized.confidence < 25)
      || (!usableFormula && text.length < MIN_EXTRACTED_TEXT_LENGTH)
    ) continue;

    const pageNumber = pageNumberFromItem(picture);
    const contentKind = route === "formula" ? "Công thức ảnh" : "Hình";
    sections.push({
      text,
      pageNumber,
      sourceLabel: pageNumber
        ? `${defaultSourceLabel(extension, pageNumber)} · ${contentKind} ${index + 1} (OCR Việt–Anh)`
        : `${contentKind} ${index + 1} (OCR Việt–Anh)`,
    });
  }

  return sections;
}

async function extractPdfEmbeddedImageSections(buffer: Buffer, skippedPages: Set<number>) {
  const sections: ExtractedSection[] = [];
  for (const image of await extractPdfEmbeddedImages(buffer)) {
    if (skippedPages.has(image.pageNumber)) continue;
    const recognized = await recognizeVietnameseImageDetailed(image.data);
    const text = normalizeExtractedText(recognized.text);
    const route = chooseVisualOcrRoute(text, await analyzeVisualOcrImage(image.data));
    const meaningfulCharacters = text.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
    const usableFormula = route === "formula" && meaningfulCharacters >= 2;
    if (
      route === "reject"
      || (route !== "formula" && recognized.confidence < 25)
      || (!usableFormula && text.length < MIN_EXTRACTED_TEXT_LENGTH)
    ) continue;
    const contentKind = route === "formula" ? "Công thức ảnh" : "Hình";
    sections.push({
      text,
      pageNumber: image.pageNumber,
      sourceLabel: `Trang ${image.pageNumber} · ${contentKind} ${image.index} (OCR Việt–Anh)`,
    });
  }
  return sections;
}

function fallbackSectionsFromDocument(
  document: DoclingDocument,
  extension: DoclingExtension,
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
  if (extension === "xmind") return extractXmind(buffer);
  if (["png", "jpg", "jpeg", "webp"].includes(extension)) {
    const recognized = await recognizeVietnameseImageDetailed(buffer);
    const text = normalizeExtractedText(recognized.text);
    return {
      text,
      pageCount: 1,
      sections: text ? [{ text, pageNumber: 1, sourceLabel: "Sơ đồ tư duy hoặc ảnh · OCR Việt–Anh" }] : [],
    };
  }

  if (["mp3", "wav", "m4a"].includes(extension)) {
    const transcript = await transcribeAudio(buffer, extension as SupportedAudioExtension);
    const sections = transcript.chunks.length
      ? transcript.chunks.map((chunk) => ({
          text: normalizeExtractedText(chunk.text),
          sourceLabel: `Bản ghi âm · ${formatTranscriptTimestamp(chunk.start)}${chunk.end === null ? "" : `–${formatTranscriptTimestamp(chunk.end)}`}${transcript.timestamp_precision === "segment" ? " (mốc theo đoạn)" : ""}`,
        })).filter((section) => section.text)
      : [{ text: normalizeExtractedText(transcript.text), sourceLabel: "Bản ghi âm" }].filter((section) => section.text);
    return {
      text: normalizeExtractedText(sections.map((section) => section.text).join("\n\n")),
      sections,
    };
  }

  requireDoclingRuntime();

  const doclingExtension = extension as DoclingExtension;

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
      forceFullPageOcr: doclingExtension === "pdf" && DOCLING_FORCE_FULL_PAGE_OCR,
    });
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
  if (result.status === "failure") {
    throw new Error(`Docling không thể xử lý tài liệu ${extension.toUpperCase()}.`);
  }

  const document = parseDoclingDocument(result.content);
  const chunks = await chunkDocumentAsync(result.content, { chunker: "hierarchical" });
  const structuredSections = sectionsFromDoclingChunks(chunks, document, doclingExtension);
  const textSections = structuredSections.length
    ? structuredSections
    : fallbackSectionsFromDocument(document, doclingExtension);
  // Hierarchical chunking can omit standalone headings (e.g. a mind map's
  // central topic). Preserve them from Docling's own output, without OCR or
  // duplicating headings already contextualized into another chunk.
  const normalizedPageText = new Map<number | undefined, string>();
  for (const section of textSections) {
    normalizedPageText.set(section.pageNumber,
      `${normalizedPageText.get(section.pageNumber) ?? ""} ${section.text}`.normalize("NFC").replace(/\s+/g, " "));
  }
  for (const item of document.texts ?? []) {
    if (!["section_header", "title"].includes(item.label ?? "")) continue;
    const text = normalizeExtractedText(item.text || item.orig || "");
    const pageNumber = pageNumberFromItem(item);
    const normalized = text.normalize("NFC").replace(/\s+/g, " ");
    const existing = normalizedPageText.get(pageNumber) ?? "";
    if (normalized && !existing.includes(normalized)) {
      textSections.push({ text, pageNumber, sourceLabel: defaultSourceLabel(doclingExtension, pageNumber) });
      normalizedPageText.set(pageNumber, `${existing} ${normalized}`);
    }
  }
  const scannedPdfSections = doclingExtension === "pdf"
    ? await extractScannedPdfSections(buffer)
    : [];
  const scannedPages = new Set(scannedPdfSections.map((section) => section.pageNumber));
  const imageSections = doclingExtension === "pdf"
    ? await extractPdfEmbeddedImageSections(buffer, scannedPages)
    : await extractEmbeddedImageSections(document, doclingExtension);
  const sections = [
    ...textSections.filter((section) => !section.pageNumber || !scannedPages.has(section.pageNumber)),
    ...imageSections.filter((section) => !section.pageNumber || !scannedPages.has(section.pageNumber)),
    ...scannedPdfSections,
  ];
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
