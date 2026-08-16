import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { recognizeVietnameseImage } from "./vietnamese-ocr.ts";

const MIN_TEXT_LAYER_CHARACTERS = 20;
const MIN_OCR_CHARACTERS = 20;
const PDF_RENDER_SCALE = 2.5;
const MAX_SCANNED_PAGES = Number(process.env.SCHOLARFLOW_MAX_SCANNED_PDF_PAGES ?? 200);

function textLayerLength(items: Array<unknown>) {
  return items.reduce<number>((total, item) => {
    if (!item || typeof item !== "object" || !("str" in item)) return total;
    const value = (item as { str?: unknown }).str;
    return total + (typeof value === "string" ? value.replace(/\s/g, "").length : 0);
  }, 0);
}

export type ScannedPdfSection = {
  text: string;
  pageNumber: number;
  sourceLabel: string;
};

export async function extractScannedPdfSections(buffer: Buffer) {
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });
  const document = await loadingTask.promise;
  const sections: ScannedPdfSection[] = [];
  try {
    const pageLimit = Math.min(document.numPages, Math.max(0, MAX_SCANNED_PAGES));
    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      if (textLayerLength(textContent.items) >= MIN_TEXT_LAYER_CHARACTERS) {
        page.cleanup();
        continue;
      }

      const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: canvas.getContext("2d") as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;
      const text = await recognizeVietnameseImage(canvas.toBuffer("image/png"));
      page.cleanup();
      if (text.replace(/\s/g, "").length < MIN_OCR_CHARACTERS) continue;
      sections.push({ text, pageNumber, sourceLabel: `Trang ${pageNumber} · OCR tiếng Việt` });
    }
    return sections;
  } finally {
    await loadingTask.destroy();
  }
}
