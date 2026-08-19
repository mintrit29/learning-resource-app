import { access } from "node:fs/promises";
import path from "node:path";
import { createWorker, OEM, PSM } from "tesseract.js";
import { prepareImageForOcr } from "./prepare-image-for-ocr.ts";

const VIETNAMESE_MODEL = "vie.traineddata";
const TECHNICAL_MODEL = "eng.traineddata";

type VietnameseOcrGlobal = typeof globalThis & {
  scholarFlowVietnameseOcrWorkerV2?: Promise<Awaited<ReturnType<typeof createWorker>>>;
  scholarFlowTechnicalOcrWorkerV2?: Promise<Awaited<ReturnType<typeof createWorker>>>;
  scholarFlowVietnameseOcrTail?: Promise<void>;
};

function tessdataRoot() {
  if (process.env.SCHOLARFLOW_TESSDATA_PATH) return process.env.SCHOLARFLOW_TESSDATA_PATH;
  if (process.env.DOCLING_RS_HOME) {
    return path.join(process.env.DOCLING_RS_HOME, "models", "tesseract");
  }
  return path.join(
    /* turbopackIgnore: true */ process.cwd(),
    ".docling-runtime",
    "models",
    "tesseract",
  );
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

async function createLocalOcrWorker(language: "vie" | "eng", pageSegmentationMode: PSM) {
  const languageRoot = tessdataRoot();
  const model = language === "vie" ? VIETNAMESE_MODEL : TECHNICAL_MODEL;
  await access(path.join(/* turbopackIgnore: true */ languageRoot, model)).catch(() => {
    throw new Error("Thiếu model OCR Việt–Anh. Hãy tải lại thành phần Docling trong Cài đặt.");
  });
  return createWorker(language, OEM.LSTM_ONLY, {
    langPath: languageRoot,
    gzip: false,
    cacheMethod: "none",
  }).then(async (worker) => {
    await worker.setParameters({
      tessedit_pageseg_mode: pageSegmentationMode,
      preserve_interword_spaces: "1",
    });
    return worker;
  });
}

async function getVietnameseOcrWorker() {
  const shared = globalThis as VietnameseOcrGlobal;
  if (!shared.scholarFlowVietnameseOcrWorkerV2) {
    shared.scholarFlowVietnameseOcrWorkerV2 = createLocalOcrWorker("vie", PSM.SPARSE_TEXT)
      .catch((error) => {
      delete shared.scholarFlowVietnameseOcrWorkerV2;
      throw error;
    });
  }
  return shared.scholarFlowVietnameseOcrWorkerV2;
}

async function getTechnicalOcrWorker() {
  const shared = globalThis as VietnameseOcrGlobal;
  if (!shared.scholarFlowTechnicalOcrWorkerV2) {
    shared.scholarFlowTechnicalOcrWorkerV2 = createLocalOcrWorker("eng", PSM.AUTO)
      .catch((error) => {
        delete shared.scholarFlowTechnicalOcrWorkerV2;
        throw error;
      });
  }
  return shared.scholarFlowTechnicalOcrWorkerV2;
}

function parenthesisBalance(value: string) {
  return [...value].reduce((balance, character) => {
    if (character === "(") return balance + 1;
    if (character === ")") return balance - 1;
    return balance;
  }, 0);
}

function formulaQuality(value: string) {
  let score = 0;
  if (/[A-Za-z]\([A-Za-z0-9]+\)\s*=/.test(value)) score += 8;
  if (/\bO\s*\([^\n]+\)/i.test(value)) score += 4;
  if (/[=+*/<>]/.test(value)) score += 2;
  if (parenthesisBalance(value) === 0) score += 2;
  return score;
}

function comparableFormula(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9=+*/()<>]/g, "");
}

function formulaSimilarity(left: string, right: string) {
  const leftComparable = comparableFormula(left);
  const rightComparable = comparableFormula(right);
  if (!leftComparable || !rightComparable) return 0;
  const leftSet = new Set(leftComparable);
  const rightSet = new Set(rightComparable);
  const shared = [...leftSet].filter((character) => rightSet.has(character)).length;
  return shared / Math.max(leftSet.size, rightSet.size);
}

function hasVietnameseDiacritics(value: string) {
  return /đ/i.test(value) || /[\u0300-\u036f]/u.test(value.normalize("NFD"));
}

function comparableLine(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function editSimilarity(left: string, right: string) {
  const a = comparableLine(left);
  const b = comparableLine(right);
  if (!a || !b) return 0;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}

function asciiTechnicalQuality(value: string) {
  const words = value.match(/[A-Za-z][A-Za-z0-9_-]*/g) ?? [];
  const suspicious = value.match(/[¦¬°†‡�]/g)?.length ?? 0;
  return words.join("").length + words.length * 2 - suspicious * 5;
}

function hasKnownTechnicalIdentifier(value: string) {
  return /\b(?:Infinity|NaN|const|function|return|class|interface|Dijkstra|Bellman-Ford)\b/.test(value);
}

export function mergeVietnameseAndTechnicalOcrText(vietnameseText: string, technicalText: string) {
  const primary = normalizeVietnameseOcrText(vietnameseText);
  const technical = normalizeVietnameseOcrText(technicalText);
  if (!primary) return technical;
  if (!technical) return primary;

  const primaryLines = primary.split("\n");
  const technicalFormulaLines = technical.split("\n").filter((line) => formulaQuality(line) >= 6);
  for (const technicalLine of technicalFormulaLines) {
    let bestIndex = -1;
    let bestSimilarity = 0;
    for (const [index, primaryLine] of primaryLines.entries()) {
      if (!/[=+*/<>]/.test(primaryLine)) continue;
      const similarity = formulaSimilarity(primaryLine, technicalLine);
      if (similarity > bestSimilarity) {
        bestIndex = index;
        bestSimilarity = similarity;
      }
    }
    if (
      bestIndex >= 0
      && bestSimilarity >= 0.65
      && formulaQuality(technicalLine) > formulaQuality(primaryLines[bestIndex] ?? "")
    ) {
      primaryLines[bestIndex] = technicalLine;
    }
  }


  // Tesseract's English pass is often better for plain English sentences and
  // identifiers (for example `documents` and `Infinity`). Only replace a
  // strongly aligned, non-Vietnamese line so accents are never downgraded.
  for (const technicalLine of technical.split("\n")) {
    if (formulaQuality(technicalLine) >= 6 || hasVietnameseDiacritics(technicalLine)) continue;
    let bestIndex = -1;
    let bestSimilarity = 0;
    for (const [index, primaryLine] of primaryLines.entries()) {
      if (hasVietnameseDiacritics(primaryLine)) continue;
      const similarity = editSimilarity(primaryLine, technicalLine);
      if (similarity > bestSimilarity) {
        bestIndex = index;
        bestSimilarity = similarity;
      }
    }
    if (
      bestIndex >= 0
      && bestSimilarity >= 0.65
      && (
        asciiTechnicalQuality(technicalLine) > asciiTechnicalQuality(primaryLines[bestIndex] ?? "")
        || bestSimilarity >= 0.9
        || (
          bestSimilarity >= 0.85
          && asciiTechnicalQuality(technicalLine) >= asciiTechnicalQuality(primaryLines[bestIndex] ?? "")
        )
        || (
          hasKnownTechnicalIdentifier(technicalLine)
          && asciiTechnicalQuality(technicalLine) >= asciiTechnicalQuality(primaryLines[bestIndex] ?? "")
        )
      )
    ) {
      primaryLines[bestIndex] = technicalLine;
    }
  }

  const technicalIdentifiers = technical.match(
    /\b(?:Infinity|NaN|const|function|return|class|interface|Dijkstra|Bellman-Ford)\b/g,
  ) ?? [];
  for (const identifier of technicalIdentifiers) {
    for (const [index, primaryLine] of primaryLines.entries()) {
      if (hasVietnameseDiacritics(primaryLine)) continue;
      primaryLines[index] = primaryLine.replace(/[A-Za-z][A-Za-z0-9_-]*/g, (word) => (
        editSimilarity(word, identifier) >= 0.75 ? identifier : word
      ));
    }
  }
  return normalizeVietnameseOcrText(primaryLines.join("\n"));
}

export type VietnameseOcrResult = {
  confidence: number;
  technicalConfidence: number;
  text: string;
  vietnameseConfidence: number;
};

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

export async function recognizeVietnameseImageDetailed(image: Buffer): Promise<VietnameseOcrResult> {
  if (!image.length) throw new Error("Ảnh OCR trống.");
  return enqueueVietnameseOcr(async () => {
    const preparedImage = await prepareImageForOcr(image);
    const [vietnameseWorker, technicalWorker] = await Promise.all([
      getVietnameseOcrWorker(),
      getTechnicalOcrWorker(),
    ]);
    const [vietnameseResult, technicalResult] = await Promise.all([
      vietnameseWorker.recognize(preparedImage),
      // Keep the original pixels for the English pass. Upscaling helps small
      // Vietnamese accents, but testing showed it can turn `documents` into
      // `documenfts` and `Infinity` into `Tnfinity` on already sharp images.
      technicalWorker.recognize(image),
    ]);
    const text = mergeVietnameseAndTechnicalOcrText(
      vietnameseResult.data.text,
      technicalResult.data.text,
    );
    const vietnameseConfidence = vietnameseResult.data.confidence;
    const technicalConfidence = technicalResult.data.confidence;
    return {
      text,
      vietnameseConfidence,
      technicalConfidence,
      confidence: Math.max(vietnameseConfidence, technicalConfidence),
    };
  });
}

export async function recognizeVietnameseImage(image: Buffer) {
  return (await recognizeVietnameseImageDetailed(image)).text;
}

export async function shutdownVietnameseOcr() {
  const shared = globalThis as VietnameseOcrGlobal;
  const pendingWorkers = [
    shared.scholarFlowVietnameseOcrWorkerV2,
    shared.scholarFlowTechnicalOcrWorkerV2,
  ].filter((worker) => worker !== undefined);
  delete shared.scholarFlowVietnameseOcrWorkerV2;
  delete shared.scholarFlowTechnicalOcrWorkerV2;
  delete shared.scholarFlowVietnameseOcrTail;
  await Promise.all(pendingWorkers.map(async (worker) => (await worker).terminate()));
}
