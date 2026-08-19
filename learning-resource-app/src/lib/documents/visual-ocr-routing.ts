import { createCanvas, loadImage } from "@napi-rs/canvas";

export type VisualOcrRoute = "formula" | "ocr" | "reject";

export type VisualOcrMetrics = {
  contentHeightRatio: number;
  contentWidthRatio: number;
  foregroundRatio: number;
  horizontalLongestRatio: number;
  verticalLongestRatio: number;
};

function longestDarkRunByRow(data: Uint8ClampedArray, width: number, height: number) {
  let longest = 0;
  for (let y = 0; y < height; y += 1) {
    let current = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const luminance = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
      if (data[offset + 3] > 20 && luminance < 150) {
        current += 1;
        longest = Math.max(longest, current);
      } else {
        current = 0;
      }
    }
  }
  return longest / width;
}

function longestDarkRunByColumn(data: Uint8ClampedArray, width: number, height: number) {
  let longest = 0;
  for (let x = 0; x < width; x += 1) {
    let current = 0;
    for (let y = 0; y < height; y += 1) {
      const offset = (y * width + x) * 4;
      const luminance = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
      if (data[offset + 3] > 20 && luminance < 150) {
        current += 1;
        longest = Math.max(longest, current);
      } else {
        current = 0;
      }
    }
  }
  return longest / height;
}

export async function analyzeVisualOcrImage(image: Buffer): Promise<VisualOcrMetrics> {
  const decoded = await loadImage(image);
  const canvas = createCanvas(decoded.width, decoded.height);
  const context = canvas.getContext("2d");
  context.drawImage(decoded, 0, 0);
  const pixels = context.getImageData(0, 0, decoded.width, decoded.height).data;
  let minX = decoded.width;
  let minY = decoded.height;
  let maxX = -1;
  let maxY = -1;
  let foreground = 0;

  for (let y = 0; y < decoded.height; y += 1) {
    for (let x = 0; x < decoded.width; x += 1) {
      const offset = (y * decoded.width + x) * 4;
      const luminance = pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114;
      if (pixels[offset + 3] > 20 && luminance < 210) {
        foreground += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  return {
    foregroundRatio: foreground / (decoded.width * decoded.height),
    contentWidthRatio: maxX < 0 ? 0 : (maxX - minX + 1) / decoded.width,
    contentHeightRatio: maxY < 0 ? 0 : (maxY - minY + 1) / decoded.height,
    horizontalLongestRatio: longestDarkRunByRow(pixels, decoded.width, decoded.height),
    verticalLongestRatio: longestDarkRunByColumn(pixels, decoded.width, decoded.height),
  };
}

export function countVisualMathSignals(text: string) {
  const patterns = [
    /=/g,
    /[∫Σ√±∞∇ρβεβ̂]/g,
    /[²³⁻₀₁₂ᵀ]/g,
    /\b(?:lim|sin|cos|log|sqrt|SSres|SStot)\b/gi,
    /\b[A-Z]\s*[|/]\s*[A-Z]\b/g,
  ];
  return patterns.reduce((total, pattern) => total + (text.match(pattern) ?? []).length, 0);
}

export function chooseVisualOcrRoute(text: string, metrics: VisualOcrMetrics): VisualOcrRoute {
  const naturalWords = (text.match(/\p{L}{3,}/gu) ?? []).length;
  const mathSignals = countVisualMathSignals(text);
  const codeSignals = (text.match(/\b(?:for|const|return|Infinity|function|class)\b|[{};]/g) ?? []).length;
  const hasLongStructure =
    metrics.horizontalLongestRatio >= 0.6 ||
    metrics.verticalLongestRatio >= 0.6 ||
    (metrics.horizontalLongestRatio >= 0.3 && metrics.verticalLongestRatio >= 0.3);
  const sparseFormulaShape =
    metrics.contentWidthRatio >= 0.18 &&
    metrics.contentHeightRatio > 0 &&
    metrics.contentHeightRatio <= 0.58 &&
    metrics.foregroundRatio >= 0.002 &&
    naturalWords <= 4;

  if (codeSignals < 2 && !hasLongStructure && (mathSignals >= 2 || sparseFormulaShape)) {
    return "formula";
  }
  return (text.match(/[\p{L}\p{N}]/gu) ?? []).length >= 4 ? "ocr" : "reject";
}
