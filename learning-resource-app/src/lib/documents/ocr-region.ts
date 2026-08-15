import { checkDependencies, Pipeline } from "docling.rs";

const DOCLING_OCR_LANG = process.env.DOCLING_OCR_LANG ?? "ch";
const MIN_OCR_TEXT_LENGTH = 2;

type OcrGlobal = typeof globalThis & {
  scholarFlowOcrPipeline?: Pipeline;
  scholarFlowOcrTail?: Promise<void>;
  scholarFlowLatestOcrGeneration?: number;
};

function normalizeOcrText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/<!--\s*image\s*-->/gi, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function requireOcrRuntime() {
  const dependencies = checkDependencies();
  if (dependencies.ready && dependencies.ocr) return;
  const missing = dependencies.missing.length ? dependencies.missing.join(", ") : "OCR models";
  throw new Error(`Docling OCR chưa sẵn sàng (${missing}). Hãy cài Docling trong Thành phần cục bộ.`);
}

function getOcrPipeline() {
  const shared = globalThis as OcrGlobal;
  shared.scholarFlowOcrPipeline ??= new Pipeline({
    strict: true,
    ocrLang: DOCLING_OCR_LANG,
    allowedFormats: ["image"],
  });
  return shared.scholarFlowOcrPipeline;
}

async function enqueueOcr<T>(operation: () => Promise<T>) {
  const shared = globalThis as OcrGlobal;
  const previous = shared.scholarFlowOcrTail ?? Promise.resolve();
  let release: () => void = () => undefined;
  shared.scholarFlowOcrTail = new Promise<void>((resolve) => { release = resolve; });
  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    release();
  }
}

export async function recognizeSearchRegion(image: Buffer) {
  requireOcrRuntime();
  if (!image.length) throw new Error("Ảnh vùng chọn trống.");
  const shared = globalThis as OcrGlobal;
  const generation = (shared.scholarFlowLatestOcrGeneration ?? 0) + 1;
  shared.scholarFlowLatestOcrGeneration = generation;

  return enqueueOcr(async () => {
    if (shared.scholarFlowLatestOcrGeneration !== generation) {
      throw new Error("Vùng chọn này đã được thay thế bởi vùng mới hơn.");
    }
    const result = await getOcrPipeline().convertAsync(
      { name: "search-selection.png", data: image, format: "image" },
      { to: "markdown", imageMode: "placeholder" },
    );
    if (result.status === "failure") throw new Error("Docling không thể nhận dạng vùng đã chọn.");
    const text = normalizeOcrText(result.content);
    if (text.length < MIN_OCR_TEXT_LENGTH) {
      throw new Error("Không nhận ra đủ chữ. Hãy chọn rộng hơn và gồm cả nhãn hoặc chú thích.");
    }
    return text;
  });
}
