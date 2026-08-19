import { createCanvas, loadImage } from "@napi-rs/canvas";

const CONTENT_THRESHOLD = 245;
const CROP_PADDING = 16;
const TARGET_MIN_WIDTH = 1_800;
const TARGET_MIN_HEIGHT = 500;
const MAX_SCALE = 4;
const MAX_OUTPUT_EDGE = 4_096;

type Bounds = { bottom: number; left: number; right: number; top: number };

function contentBounds(data: Uint8ClampedArray, width: number, height: number): Bounds | null {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (data[offset + 3] <= 20) continue;
      if (
        data[offset] >= CONTENT_THRESHOLD
        && data[offset + 1] >= CONTENT_THRESHOLD
        && data[offset + 2] >= CONTENT_THRESHOLD
      ) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) return null;
  return {
    left: Math.max(0, left - CROP_PADDING),
    top: Math.max(0, top - CROP_PADDING),
    right: Math.min(width - 1, right + CROP_PADDING),
    bottom: Math.min(height - 1, bottom + CROP_PADDING),
  };
}

function outputScale(width: number, height: number) {
  const desired = Math.max(1, TARGET_MIN_WIDTH / width, TARGET_MIN_HEIGHT / height);
  return Math.min(
    MAX_SCALE,
    MAX_OUTPUT_EDGE / width,
    MAX_OUTPUT_EDGE / height,
    desired,
  );
}

/**
 * Normalize every OCR input the same way, whether it came from document
 * ingestion or from the interactive visual-search crop.
 */
export async function prepareImageForOcr(image: Buffer) {
  const source = await loadImage(image);
  const sourceCanvas = createCanvas(source.width, source.height);
  const sourceContext = sourceCanvas.getContext("2d");
  sourceContext.fillStyle = "#ffffff";
  sourceContext.fillRect(0, 0, source.width, source.height);
  sourceContext.drawImage(source, 0, 0);

  const sourceData = sourceContext.getImageData(0, 0, source.width, source.height);
  const bounds = contentBounds(sourceData.data, source.width, source.height);
  if (!bounds) return image;

  const cropWidth = bounds.right - bounds.left + 1;
  const cropHeight = bounds.bottom - bounds.top + 1;
  const scale = outputScale(cropWidth, cropHeight);
  const outputWidth = Math.max(1, Math.round(cropWidth * scale));
  const outputHeight = Math.max(1, Math.round(cropHeight * scale));
  const output = createCanvas(outputWidth, outputHeight);
  const outputContext = output.getContext("2d");
  outputContext.fillStyle = "#ffffff";
  outputContext.fillRect(0, 0, outputWidth, outputHeight);
  outputContext.imageSmoothingEnabled = true;
  outputContext.drawImage(
    source,
    bounds.left,
    bounds.top,
    cropWidth,
    cropHeight,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  return output.toBuffer("image/png");
}
