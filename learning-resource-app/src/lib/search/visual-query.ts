export function normalizeVisualQueryText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function comparableText(value: string) {
  return normalizeVisualQueryText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

export function mergeRecognizedText(ocrText: string, nativeText: string) {
  const ocr = normalizeVisualQueryText(ocrText);
  const native = normalizeVisualQueryText(nativeText);
  if (!native) return ocr;
  const comparableOcr = comparableText(ocr);
  const comparableNative = comparableText(native);
  if (
    comparableOcr === comparableNative
    || comparableOcr.includes(comparableNative)
    || comparableNative.includes(comparableOcr)
  ) {
    return native;
  }
  return `${ocr}\n\n${native}`;
}
