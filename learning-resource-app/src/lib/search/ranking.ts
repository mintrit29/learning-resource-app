export type SearchCandidate = {
  chunkId: string;
  documentId: string;
  title: string;
  fileType: string;
  primaryTopic: string | null;
  difficulty: string | null;
  content: string;
  pageNumber: number | null;
  sourceLabel: string | null;
  semanticScore?: number;
  keywordScore?: number;
};

export type RankedSearchResult = Omit<SearchCandidate, "semanticScore" | "keywordScore"> & {
  score: number;
  semanticScore: number | null;
  keywordScore: number | null;
  matchReasons: string[];
};

type RankCriteria = {
  difficulty?: string | null;
  fileType?: string | null;
  keywords?: string[];
};

const STOP_WORDS = new Set([
  "ai", "cai", "cac", "cho", "co", "cua", "do", "du", "duoc", "gi", "giai", "hay", "la", "lieu", "moi", "mot", "nao", "nay", "nguoi", "nhung", "phan", "so", "tai", "the", "thich", "tim", "toi", "trong", "va", "ve", "voi",
  "a", "an", "and", "are", "for", "in", "is", "of", "on", "or", "the", "to", "what", "with",
]);

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function extractKeywordTerms(query: string) {
  const terms = normalizeSearchText(query)
    .split(" ")
    .filter((term) => term.length >= 2 && !STOP_WORDS.has(term));
  return [...new Set(terms)].slice(0, 8);
}

export function inferSearchCriteria(query: string) {
  const normalized = ` ${normalizeSearchText(query)} `;
  const difficulty = normalized.match(/\b(nguoi moi|co ban|beginner|intro|nhap mon)\b/)
    ? "BEGINNER"
    : normalized.match(/\b(nang cao|advanced|chuyen sau)\b/)
      ? "ADVANCED"
      : normalized.match(/\b(trung binh|intermediate)\b/)
        ? "INTERMEDIATE"
        : null;
  const fileType = normalized.match(/\b(pdf)\b/)
    ? "PDF"
    : normalized.match(/\b(slide|slides|ppt|pptx)\b/)
      ? "PPTX"
      : normalized.match(/\b(doc|docx|word)\b/)
        ? "DOCX"
        : normalized.match(/\b(epub|ebook)\b/)
          ? "EPUB"
          : null;

  return { difficulty, fileType, keywords: extractKeywordTerms(query) };
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function rankSearchCandidates(
  vectorCandidates: SearchCandidate[],
  keywordCandidates: SearchCandidate[],
  limit = 30,
  criteria: RankCriteria = {},
) {
  const merged = new Map<string, SearchCandidate & { vectorRank?: number; keywordRank?: number }>();

  vectorCandidates.forEach((candidate, index) => {
    merged.set(candidate.chunkId, { ...candidate, vectorRank: index + 1 });
  });
  keywordCandidates.forEach((candidate, index) => {
    const current = merged.get(candidate.chunkId);
    merged.set(candidate.chunkId, { ...current, ...candidate, vectorRank: current?.vectorRank, keywordRank: index + 1 });
  });

  const maxKeywordScore = Math.max(1, ...keywordCandidates.map((item) => item.keywordScore ?? 0));
  const ranked = [...merged.values()]
    .map((candidate): RankedSearchResult => {
      const semantic = candidate.semanticScore == null ? null : clamp(candidate.semanticScore);
      const keyword = candidate.keywordScore == null ? null : clamp(candidate.keywordScore / maxKeywordScore);
      const vectorRankSignal = candidate.vectorRank ? 1 / (1 + (candidate.vectorRank - 1) * 0.08) : 0;
      const keywordRankSignal = candidate.keywordRank ? 1 / (1 + (candidate.keywordRank - 1) * 0.1) : 0;
      const hasBoth = semantic !== null && keyword !== null;
      const retrievalScore = hasBoth
        ? 0.55 * (semantic ?? 0) + 0.25 * (keyword ?? 0) + 0.12 * vectorRankSignal + 0.08 * keywordRankSignal + 0.05
        : semantic !== null
          ? 0.82 * semantic + 0.18 * vectorRankSignal
          : 0.8 * (keyword ?? 0) + 0.2 * keywordRankSignal;
      const matchesFileType = Boolean(criteria.fileType && candidate.fileType === criteria.fileType);
      const matchesDifficulty = Boolean(criteria.difficulty && candidate.difficulty === criteria.difficulty);
      const normalizedTopic = normalizeSearchText(candidate.primaryTopic ?? "");
      const matchesTopic = Boolean(normalizedTopic && criteria.keywords?.some((keyword) => normalizedTopic.includes(keyword)));
      const score = retrievalScore
        + (matchesFileType ? 0.05 : 0)
        + (matchesDifficulty ? 0.05 : 0)
        + (matchesTopic ? 0.05 : 0);
      const matchReasons = [
        semantic !== null ? "Khớp ngữ nghĩa" : null,
        keyword !== null ? "Khớp từ khóa" : null,
        matchesFileType ? "Đúng định dạng" : null,
        matchesDifficulty ? "Đúng độ khó" : null,
        matchesTopic ? "Đúng chủ đề" : null,
      ].filter((reason): reason is string => Boolean(reason));

      const result = {
        chunkId: candidate.chunkId,
        documentId: candidate.documentId,
        title: candidate.title,
        fileType: candidate.fileType,
        primaryTopic: candidate.primaryTopic,
        difficulty: candidate.difficulty,
        content: candidate.content,
        pageNumber: candidate.pageNumber,
        sourceLabel: candidate.sourceLabel,
      };
      return {
        ...result,
        score: clamp(score),
        semanticScore: semantic,
        keywordScore: keyword,
        matchReasons,
      };
    })
    .sort((left, right) => right.score - left.score);
  const bestScore = ranked[0]?.score ?? 0;
  const relevanceFloor = Math.max(0.45, bestScore - 0.25);
  return ranked.filter((result) => result.score >= relevanceFloor).slice(0, limit);
}
