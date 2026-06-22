export type TextChunk = {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  pageNumber?: number;
  sourceLabel?: string;
};

const TARGET_WORDS = 320;
const MAX_WORDS = 380;
const MIN_FINAL_WORDS = 180;
const OVERLAP_WORDS = 40;

function estimateTokens(wordCount: number) {
  return Math.ceil(wordCount * 1.3);
}

export function chunkDocumentSections(
  sections: Array<{ text: string; pageNumber?: number; sourceLabel?: string }>,
): TextChunk[] {
  const chunks: TextChunk[] = [];

  for (const section of sections) {
    const sectionChunks = chunkDocumentText(section.text);
    for (const chunk of sectionChunks) {
      chunks.push({
        ...chunk,
        chunkIndex: chunks.length,
        pageNumber: section.pageNumber,
        sourceLabel: section.sourceLabel,
      });
    }
  }

  return chunks;
}

export function chunkDocumentText(text: string): TextChunk[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length === 0) return [];

  const chunks: TextChunk[] = [];
  let start = 0;

  while (start < words.length) {
    let end = Math.min(start + TARGET_WORDS, words.length);
    const remaining = words.length - end;

    if (remaining > 0 && remaining < MIN_FINAL_WORDS) {
      end = Math.min(start + MAX_WORDS, words.length);
    }

    const chunkWords = words.slice(start, end);
    chunks.push({
      chunkIndex: chunks.length,
      content: chunkWords.join(" "),
      tokenCount: estimateTokens(chunkWords.length),
    });

    if (end >= words.length) break;
    start = Math.max(end - OVERLAP_WORDS, start + 1);
  }

  return chunks;
}
