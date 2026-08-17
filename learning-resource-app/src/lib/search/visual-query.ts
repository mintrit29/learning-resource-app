export function normalizeVisualQueryText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function mergeRecognizedText(ocrText: string, nativeText: string) {
  const ocr = normalizeVisualQueryText(ocrText);
  const native = normalizeVisualQueryText(nativeText);
  return ocr || native;
}
