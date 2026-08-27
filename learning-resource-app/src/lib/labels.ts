export const difficultyLabels: Record<string, string> = {
  BEGINNER: "Cơ bản",
  INTERMEDIATE: "Trung cấp",
  ADVANCED: "Nâng cao",
};

export function formatDifficulty(value?: string | null) {
  if (!value) return "Chưa rõ";
  return difficultyLabels[value] ?? value;
}

export const fileTypeLabels: Record<string, string> = {
  PDF: "PDF",
  PPTX: "PPTX",
  DOCX: "DOCX",
  EPUB: "EPUB",
  IMAGE: "Ảnh",
  AUDIO: "Âm thanh",
  XMIND: "XMind",
};

export function formatFileType(value: string) {
  return fileTypeLabels[value] ?? value;
}
