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
  keywordGroups?: string[][];
};

export type SearchRankingDiagnostics = {
  bestScore: number;
  acceptanceThreshold: number;
  rejectedCandidateCount: number;
  rejectionReason: "LOW_RELEVANCE" | null;
};

const STOP_WORDS = new Set([
  "ai", "cai", "cac", "cho", "co", "cua", "do", "du", "duoc", "gi", "giai", "hay", "la", "lieu", "moi", "mot", "nao", "nay", "nguoi", "nhung", "phan", "so", "tai", "the", "thich", "tim", "toi", "trong", "va", "ve", "voi",
  "a", "about", "an", "and", "are", "between", "difference", "for", "in", "is", "of", "on", "or", "the", "to", "what", "with",
]);

const QUERY_CONCEPT_ALIASES: Array<[string, string[]]> = [
  ["khoang trong nghien cuu", ["research gap", "research gaps"]],
  ["cau truc du lieu", ["data structure", "data structures"]],
  ["co so du lieu", ["database", "databases"]],
  ["nguon hoc thuat", ["academic source", "academic sources"]],
  ["cau hoi nghien cuu", ["research question", "research questions"]],
  ["mo hinh cay", ["tree", "trees"]],
  ["cay truoc", ["previous tree", "previous"]],
  ["sua loi", ["correct error", "correct errors", "corrects errors"]],
  ["dang tin cay", ["reliable", "trustworthy"]],
  ["giao dich", ["transaction", "transactions"]],
  ["danh gia", ["evaluate", "evaluated", "evaluation"]],
  ["bao mat", ["security", "secure"]],
  ["xac dinh", ["identify", "identifies", "identification"]],
  ["rui ro", ["risk", "risks"]],
  ["nguoi moi", ["beginner", "beginners", "intro", "introduction"]],
  ["trung cap", ["intermediate"]],
  ["nang cao", ["advanced"]],
];

const BOILERPLATE_PATTERNS = [
  "about the book",
  "acknowledgements",
  "all rights reserved",
  "copyright",
  "creative commons",
  "isbn",
  "license",
  "licensed under",
  "publisher information",
  "preface",
  "table of contents",
];

const BOILERPLATE_QUERY_TERMS = ["acknowledgements", "copyright", "license", "preface", "table of contents"];

const SEMANTIC_ONLY_THRESHOLD = 0.55;

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

export function extractKeywordGroups(query: string) {
  let remaining = normalizeSearchText(query);
  const groups: string[][] = [];

  for (const [phrase, aliases] of QUERY_CONCEPT_ALIASES) {
    const padded = ` ${remaining} `;
    if (!padded.includes(` ${phrase} `)) continue;
    groups.push([phrase, ...aliases]);
    remaining = padded.replace(` ${phrase} `, " ").trim();
  }

  const terms = remaining
    .split(" ")
    .filter((term) => term.length >= 2 && !STOP_WORDS.has(term));
  groups.push(...[...new Set(terms)].map((term) => [term]));
  return groups.slice(0, 10);
}

export function extractKeywordTerms(query: string) {
  return [...new Set(extractKeywordGroups(query).flat())].slice(0, 20);
}

export function inferSearchCriteria(query: string) {
  const normalized = ` ${normalizeSearchText(query)} `;
  const difficulty = normalized.match(/\b(nguoi moi|co ban|beginner|intro|nhap mon)\b/)
    ? "BEGINNER"
    : normalized.match(/\b(nang cao|advanced|chuyen sau)\b/)
      ? "ADVANCED"
      : normalized.match(/\b(trung binh|trung cap|intermediate)\b/)
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

  const keywordGroups = extractKeywordGroups(query);
  return { difficulty, fileType, keywords: [...new Set(keywordGroups.flat())], keywordGroups };
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function containsTerm(text: string, term: string) {
  return ` ${text} `.includes(` ${term} `);
}

function groupCoverage(text: string, groups: string[][]) {
  if (!groups.length) return 0;
  const matches = groups.filter((group) => group.some((term) => containsTerm(text, term))).length;
  return matches / groups.length;
}

function hasBoilerplate(content: string, sourceLabel: string) {
  const contentStart = content.slice(0, 240);
  return BOILERPLATE_PATTERNS.some((pattern) => sourceLabel.includes(pattern) || contentStart.includes(pattern));
}

type ScoredSearchResult = RankedSearchResult & {
  lexicalCoverage: number;
  contentCoverage: number;
  passesRelevanceGate: boolean;
};

export function rankSearchCandidatesWithDiagnostics(
  vectorCandidates: SearchCandidate[],
  keywordCandidates: SearchCandidate[],
  limit = 30,
  criteria: RankCriteria = {},
): { results: RankedSearchResult[]; diagnostics: SearchRankingDiagnostics } {
  const groups = criteria.keywordGroups ?? (criteria.keywords ?? []).map((keyword) => [keyword]);
  const queryRequestsBoilerplate = groups.flat().some((term) => BOILERPLATE_QUERY_TERMS.includes(term));
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
    .map((candidate): ScoredSearchResult => {
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

      const normalizedContent = normalizeSearchText(candidate.content);
      const normalizedTitle = normalizeSearchText(candidate.title);
      const normalizedTopic = normalizeSearchText(candidate.primaryTopic ?? "");
      const normalizedSourceLabel = normalizeSearchText(candidate.sourceLabel ?? "");
      const contentCoverage = groupCoverage(normalizedContent, groups);
      const titleCoverage = groupCoverage(normalizedTitle, groups);
      const topicCoverage = groupCoverage(normalizedTopic, groups);
      const lexicalCoverage = Math.max(contentCoverage, titleCoverage, topicCoverage);
      const matchesFileType = Boolean(criteria.fileType && candidate.fileType === criteria.fileType);
      const matchesDifficulty = Boolean(criteria.difficulty && candidate.difficulty === criteria.difficulty);
      const matchesTopic = topicCoverage > 0;
      const satisfiesFileType = !criteria.fileType || candidate.fileType === criteria.fileType;
      const satisfiesDifficulty = !criteria.difficulty || candidate.difficulty === criteria.difficulty;
      const coverageThreshold = groups.length <= 2 ? 0.5 : 0.4;
      const hasLexicalEvidence = groups.length > 0 && lexicalCoverage >= coverageThreshold;
      const hasStrongSemanticEvidence = (semantic ?? 0) >= SEMANTIC_ONLY_THRESHOLD;
      const passesRelevanceGate = (hasLexicalEvidence || hasStrongSemanticEvidence)
        && satisfiesFileType
        && satisfiesDifficulty;
      const boilerplatePenalty = hasBoilerplate(normalizedContent, normalizedSourceLabel) && !queryRequestsBoilerplate ? 0.32 : 0;
      const score = 0.68 * retrievalScore
        + 0.2 * contentCoverage
        + 0.08 * titleCoverage
        + 0.04 * topicCoverage
        + (matchesFileType ? 0.04 : 0)
        + (matchesDifficulty ? 0.04 : 0)
        - boilerplatePenalty;
      const matchReasons = [
        semantic !== null ? "Khớp ngữ nghĩa" : null,
        keyword !== null && lexicalCoverage > 0 ? "Khớp từ khóa" : null,
        matchesFileType ? "Đúng định dạng" : null,
        matchesDifficulty ? "Đúng độ khó" : null,
        matchesTopic ? "Đúng chủ đề" : null,
      ].filter((reason): reason is string => Boolean(reason));

      return {
        chunkId: candidate.chunkId,
        documentId: candidate.documentId,
        title: candidate.title,
        fileType: candidate.fileType,
        primaryTopic: candidate.primaryTopic,
        difficulty: candidate.difficulty,
        content: candidate.content,
        pageNumber: candidate.pageNumber,
        sourceLabel: candidate.sourceLabel,
        score: clamp(score),
        semanticScore: semantic,
        keywordScore: keyword,
        matchReasons,
        lexicalCoverage,
        contentCoverage,
        passesRelevanceGate,
      };
    })
    .sort((left, right) => right.score - left.score);

  const accepted = ranked.filter((result) => result.passesRelevanceGate);
  const bestScore = accepted[0]?.score ?? ranked[0]?.score ?? 0;
  const relevanceFloor = Math.max(0.32, bestScore - 0.25);
  const results = accepted
    .filter((result) => result.score >= relevanceFloor)
    .slice(0, limit)
    .map((result): RankedSearchResult => ({
      chunkId: result.chunkId,
      documentId: result.documentId,
      title: result.title,
      fileType: result.fileType,
      primaryTopic: result.primaryTopic,
      difficulty: result.difficulty,
      content: result.content,
      pageNumber: result.pageNumber,
      sourceLabel: result.sourceLabel,
      score: result.score,
      semanticScore: result.semanticScore,
      keywordScore: result.keywordScore,
      matchReasons: result.matchReasons,
    }));

  return {
    results,
    diagnostics: {
      bestScore,
      acceptanceThreshold: SEMANTIC_ONLY_THRESHOLD,
      rejectedCandidateCount: ranked.length - accepted.length,
      rejectionReason: results.length ? null : "LOW_RELEVANCE",
    },
  };
}

export function rankSearchCandidates(
  vectorCandidates: SearchCandidate[],
  keywordCandidates: SearchCandidate[],
  limit = 30,
  criteria: RankCriteria = {},
) {
  return rankSearchCandidatesWithDiagnostics(vectorCandidates, keywordCandidates, limit, criteria).results;
}
