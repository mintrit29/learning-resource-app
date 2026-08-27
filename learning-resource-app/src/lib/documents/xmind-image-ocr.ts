import { recognizeVietnameseImageDetailed } from "./vietnamese-ocr.ts";
import { analyzeVisualOcrImage, chooseVisualOcrRoute } from "./visual-ocr-routing.ts";

export async function recognizeXmindImage(data: Buffer): Promise<{ text: string; warning?: string }> {
  try {
    const recognized = await recognizeVietnameseImageDetailed(data);
    const text = recognized.text.trim();
    const route = chooseVisualOcrRoute(text, await analyzeVisualOcrImage(data));
    if (route === "reject" || !text || (route !== "formula" && recognized.confidence < 25)) {
      return { text: "", warning: "Ảnh không có chữ rõ hoặc OCR chưa đọc được; ảnh gốc vẫn được giữ để xem." };
    }
    return { text };
  } catch (error) {
    return { text: "", warning: error instanceof Error ? error.message : "OCR ảnh thất bại; chữ gốc của nhánh vẫn được giữ." };
  }
}
