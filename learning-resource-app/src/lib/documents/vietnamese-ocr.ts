import { access } from "node:fs/promises";
import path from "node:path";
import { createWorker, OEM, PSM } from "tesseract.js";

const VIETNAMESE_MODEL = "vie.traineddata";

type VietnameseOcrGlobal = typeof globalThis & {
  scholarFlowVietnameseOcrWorker?: Promise<Awaited<ReturnType<typeof createWorker>>>;
  scholarFlowVietnameseOcrTail?: Promise<void>;
};

function tessdataRoot() {
  if (process.env.SCHOLARFLOW_TESSDATA_PATH) return process.env.SCHOLARFLOW_TESSDATA_PATH;
  if (process.env.DOCLING_RS_HOME) {
    return path.join(process.env.DOCLING_RS_HOME, "models", "tesseract");
  }
  return path.join(process.cwd(), ".docling-runtime", "models", "tesseract");
}

export function normalizeVietnameseOcrText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => {
      if (!line) return false;
      const meaningful = line.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
      const visible = line.replace(/\s/g, "").length;
      return meaningful >= 2 && meaningful / Math.max(1, visible) >= 0.25;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function getVietnameseOcrWorker() {
  const shared = globalThis as VietnameseOcrGlobal;
  if (!shared.scholarFlowVietnameseOcrWorker) {
    const languageRoot = tessdataRoot();
    await access(path.join(languageRoot, VIETNAMESE_MODEL)).catch(() => {
      throw new Error("Thiếu model OCR tiếng Việt. Hãy tải lại thành phần Docling trong Cài đặt.");
    });
    shared.scholarFlowVietnameseOcrWorker = createWorker("vie", OEM.LSTM_ONLY, {
      langPath: languageRoot,
      gzip: false,
      cacheMethod: "none",
    }).then(async (worker) => {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: "1",
      });
      return worker;
    }).catch((error) => {
      delete shared.scholarFlowVietnameseOcrWorker;
      throw error;
    });
  }
  return shared.scholarFlowVietnameseOcrWorker;
}

async function enqueueVietnameseOcr<T>(operation: () => Promise<T>) {
  const shared = globalThis as VietnameseOcrGlobal;
  const previous = shared.scholarFlowVietnameseOcrTail ?? Promise.resolve();
  let release: () => void = () => undefined;
  shared.scholarFlowVietnameseOcrTail = new Promise<void>((resolve) => { release = resolve; });
  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    release();
  }
}

export async function recognizeVietnameseImage(image: Buffer) {
  if (!image.length) throw new Error("Ảnh OCR trống.");
  return enqueueVietnameseOcr(async () => {
    const worker = await getVietnameseOcrWorker();
    const result = await worker.recognize(image);
    return normalizeVietnameseOcrText(result.data.text);
  });
}

export async function shutdownVietnameseOcr() {
  const shared = globalThis as VietnameseOcrGlobal;
  const pendingWorker = shared.scholarFlowVietnameseOcrWorker;
  delete shared.scholarFlowVietnameseOcrWorker;
  delete shared.scholarFlowVietnameseOcrTail;
  if (pendingWorker) await (await pendingWorker).terminate();
}
