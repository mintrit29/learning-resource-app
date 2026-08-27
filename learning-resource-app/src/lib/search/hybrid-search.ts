import { db } from "@/lib/db";
import { embedTexts } from "@/lib/embedding/client";
import {
  extractKeywordTerms,
  inferSearchCriteria,
  normalizeSearchText,
  rankSearchCandidatesWithDiagnostics,
  type SearchCandidate,
} from "@/lib/search/ranking";
import { getSqliteVectorStore } from "@/lib/vector/sqlite-vector-store";

export type SearchFilters = {
  topic?: string;
  difficulty?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  fileType?: "PDF" | "PPTX" | "DOCX" | "EPUB" | "IMAGE" | "AUDIO" | "XMIND";
  documentId?: string;
  dateFrom?: string;
  dateTo?: string;
};

type VectorRow = Omit<SearchCandidate, "semanticScore"> & { semanticScore: number };
type KeywordRow = Omit<SearchCandidate, "keywordScore"> & { keywordScore: number };

type SearchChunk = {
  id: string;
  content: string;
  pageNumber: number | null;
  sourceLabel: string | null;
  document: {
    id: string;
    title: string;
    fileType: string;
    primaryTopic: string | null;
    difficulty: string | null;
  };
};

function startOfDay(value?: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

function endOfDay(value?: string) {
  const date = startOfDay(value);
  if (!date) return undefined;
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function documentFilter(filters: SearchFilters) {
  const dateFrom = startOfDay(filters.dateFrom);
  const dateTo = endOfDay(filters.dateTo);

  return {
    primaryTopic: filters.topic || undefined,
    difficulty: filters.difficulty,
    fileType: filters.fileType,
    id: filters.documentId || undefined,
    createdAt: dateFrom || dateTo ? { gte: dateFrom, lt: dateTo } : undefined,
  };
}

function toSearchCandidate(chunk: SearchChunk): SearchCandidate {
  return {
    chunkId: chunk.id,
    documentId: chunk.document.id,
    title: chunk.document.title,
    fileType: chunk.document.fileType,
    primaryTopic: chunk.document.primaryTopic,
    difficulty: chunk.document.difficulty,
    content: chunk.content,
    pageNumber: chunk.pageNumber,
    sourceLabel: chunk.sourceLabel,
  };
}

export async function searchByVector(
  query: string,
  filters: SearchFilters,
  limit: number,
) {
  const [embedded, chunks] = await Promise.all([
    embedTexts([query]),
    db.documentChunk.findMany({
      where: {
        embedding: { not: null },
        document: documentFilter(filters),
      },
      select: {
        id: true,
        content: true,
        pageNumber: true,
        sourceLabel: true,
        document: {
          select: {
            id: true,
            title: true,
            fileType: true,
            primaryTopic: true,
            difficulty: true,
          },
        },
      },
    }),
  ]);
  const chunkById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const matches = getSqliteVectorStore().searchChunkEmbeddings(
    embedded.embeddings[0],
    limit,
    chunks.map((chunk) => chunk.id),
  );

  return matches.flatMap((match): VectorRow[] => {
    const chunk = chunkById.get(match.chunkId);
    return chunk
      ? [{ ...toSearchCandidate(chunk), semanticScore: match.semanticScore }]
      : [];
  });
}

export async function searchByKeyword(
  query: string,
  filters: SearchFilters,
  limit: number,
) {
  const terms = extractKeywordTerms(query);
  if (!terms.length) return [];

  const normalizedPhrase = normalizeSearchText(query);
  const normalizedTerms = terms.map((term) => normalizeSearchText(term));
  const chunks = await db.documentChunk.findMany({
    where: { document: documentFilter(filters) },
    select: {
      id: true,
      content: true,
      pageNumber: true,
      sourceLabel: true,
      chunkIndex: true,
      document: {
        select: {
          id: true,
          title: true,
          fileType: true,
          primaryTopic: true,
          difficulty: true,
        },
      },
    },
  });

  return chunks
    .map((chunk): (KeywordRow & { chunkIndex: number }) | null => {
      const normalizedTitle = normalizeSearchText(chunk.document.title);
      const normalizedContent = normalizeSearchText(chunk.content);
      const paddedTitle = ` ${normalizedTitle} `;
      const paddedContent = ` ${normalizedContent} `;
      const termScore = normalizedTerms.reduce(
        (score, term) => score
          + (paddedTitle.includes(` ${term} `) ? 2 : 0)
          + (paddedContent.includes(` ${term} `) ? 1 : 0),
        0,
      );
      const phraseBonus = normalizedTitle.includes(normalizedPhrase)
        ? 3
        : normalizedContent.includes(normalizedPhrase)
          ? 1.5
          : 0;
      const keywordScore = termScore + phraseBonus;

      return keywordScore > 0
        ? { ...toSearchCandidate(chunk), keywordScore, chunkIndex: chunk.chunkIndex }
        : null;
    })
    .filter((candidate): candidate is KeywordRow & { chunkIndex: number } => Boolean(candidate))
    .sort((left, right) => right.keywordScore - left.keywordScore || left.chunkIndex - right.chunkIndex)
    .slice(0, limit)
    .map(({ chunkIndex, ...candidate }) => {
      void chunkIndex;
      return candidate;
    });
}

export async function hybridSearch(query: string, filters: SearchFilters) {
  const candidateLimit = 30;
  const [vectorAttempt, keywordAttempt] = await Promise.allSettled([
    searchByVector(query, filters, candidateLimit),
    searchByKeyword(query, filters, candidateLimit),
  ]);
  const vectorCandidates = vectorAttempt.status === "fulfilled" ? vectorAttempt.value : [];
  const keywordCandidates = keywordAttempt.status === "fulfilled" ? keywordAttempt.value : [];

  if (!vectorCandidates.length && !keywordCandidates.length) {
    const errors = [vectorAttempt, keywordAttempt]
      .filter((attempt): attempt is PromiseRejectedResult => attempt.status === "rejected")
      .map((attempt) => attempt.reason instanceof Error ? attempt.reason.message : String(attempt.reason));
    if (errors.length) throw new Error(errors.join("; "));
  }

  const ranking = rankSearchCandidatesWithDiagnostics(
    vectorCandidates,
    keywordCandidates,
    candidateLimit,
    inferSearchCriteria(query),
  );

  return {
    candidates: ranking.results,
    diagnostics: ranking.diagnostics,
    retrievalMode: vectorCandidates.length && keywordCandidates.length
      ? "hybrid"
      : vectorCandidates.length
        ? "semantic"
        : "keyword",
  } as const;
}
