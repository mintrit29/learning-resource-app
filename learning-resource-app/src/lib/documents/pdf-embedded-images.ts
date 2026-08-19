import { createCanvas } from "@napi-rs/canvas";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";

const MAX_PDF_IMAGES = Number(process.env.SCHOLARFLOW_MAX_PDF_IMAGES ?? 100);
const MAX_IMAGE_PIXELS = 20_000_000;

type PdfImageObject = {
  data?: Uint8Array | Uint8ClampedArray;
  height?: number;
  kind?: number;
  width?: number;
};

export type PdfEmbeddedImage = {
  data: Buffer;
  index: number;
  pageNumber: number;
};

function imageObjectToPng(image: PdfImageObject) {
  const width = Number(image.width ?? 0);
  const height = Number(image.height ?? 0);
  if (
    !image.data
    || !Number.isInteger(width)
    || !Number.isInteger(height)
    || width <= 0
    || height <= 0
    || width * height > MAX_IMAGE_PIXELS
  ) return null;

  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  const pixels = context.createImageData(width, height);
  if (image.data.length === width * height * 4) {
    pixels.data.set(image.data);
  } else if (image.data.length === width * height * 3) {
    for (let source = 0, target = 0; source < image.data.length; source += 3, target += 4) {
      pixels.data[target] = image.data[source];
      pixels.data[target + 1] = image.data[source + 1];
      pixels.data[target + 2] = image.data[source + 2];
      pixels.data[target + 3] = 255;
    }
  } else {
    return null;
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toBuffer("image/png");
}

function getPageImage(page: Awaited<ReturnType<Awaited<ReturnType<typeof getDocument>["promise"]>["getPage"]>>, name: string) {
  return new Promise<PdfImageObject>((resolve) => page.objs.get(name, resolve));
}

export async function extractPdfEmbeddedImages(buffer: Buffer) {
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });
  const document = await loadingTask.promise;
  const images: PdfEmbeddedImage[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      if (images.length >= MAX_PDF_IMAGES) break;
      const page = await document.getPage(pageNumber);
      const operators = await page.getOperatorList();
      const seenNames = new Set<string>();
      for (let index = 0; index < operators.fnArray.length; index += 1) {
        if (images.length >= MAX_PDF_IMAGES) break;
        if (operators.fnArray[index] !== OPS.paintImageXObject) continue;
        const name = operators.argsArray[index]?.[0];
        if (typeof name !== "string" || seenNames.has(name)) continue;
        seenNames.add(name);
        const png = imageObjectToPng(await getPageImage(page, name));
        if (!png) continue;
        images.push({ data: png, index: images.length + 1, pageNumber });
      }
      page.cleanup();
    }
    return images;
  } finally {
    await loadingTask.destroy();
  }
}
