import { db } from "@/lib/db";
import { embedTexts, toPgVector } from "@/lib/embedding/client";
import {
  extractKeywordTerms,
  inferSearchCriteria,
  normalizeSearchText,
  rankSearchCandidates,
  type SearchCandidate,
} from "@/lib/search/ranking";

export type SearchFilters = {
  topic?: string;
  difficulty?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  fileType?: "PDF" | "PPTX" | "DOCX" | "EPUB";
  documentId?: string;
  dateFrom?: string;
  dateTo?: string;
};

type VectorRow = Omit<SearchCandidate, "semanticScore"> & { semanticScore: number };
type KeywordRow = Omit<SearchCandidate, "keywordScore"> & { keywordScore: number };

const DIACRITIC_GROUPS: Record<string, string> = {
  a: "àáạảãâầấậẩẫăằắặẳẵ",
  e: "èéẹẻẽêềếệểễ",
  i: "ìíịỉĩ",
  o: "òóọỏõôồốộổỗơờớợởỡ",
  u: "ùúụủũưừứựửữ",
  y: "ỳýỵỷỹ",
  d: "đ",
};
const DIACRITIC_FROM = Object.values(DIACRITIC_GROUPS).join("");
const DIACRITIC_TO = Object.entries(DIACRITIC_GROUPS)
  .map(([plain, variants]) => plain.repeat([...variants].length))
  .join("");

function normalizedSql(expression: string) {
  return `translate(lower(${expression}), '${DIACRITIC_FROM}', '${DIACRITIC_TO}')`;
}

function filterSql() {
  return `d."userId" = $2
    AND ($3::text IS NULL OR d."primaryTopic" = $3::text)
    AND ($4::text IS NULL OR d."difficulty"::text = $4::text)
    AND ($5::text IS NULL OR d."fileType"::text = $5::text)
    AND ($6::text IS NULL OR d."id" = $6::text)
    AND ($7::timestamptz IS NULL OR d."createdAt" >= $7::timestamptz)
    AND ($8::timestamptz IS NULL OR d."createdAt" < ($8::timestamptz + interval '1 day'))`;
}

function filterParams(userId: string, filters: SearchFilters) {
  return [
    userId,
    filters.topic || null,
    filters.difficulty || null,
    filters.fileType || null,
    filters.documentId || null,
    filters.dateFrom || null,
    filters.dateTo || null,
  ];
}

async function searchByVector(userId: string, query: string, filters: SearchFilters, limit: number) {
  const embedded = await embedTexts([query]);
  const vector = toPgVector(embedded.embeddings[0]);
  return db.$queryRawUnsafe<VectorRow[]>(
    `SELECT c."id" AS "chunkId", d."id" AS "documentId", d."title",
      d."fileType"::text AS "fileType", d."primaryTopic", d."difficulty"::text AS "difficulty",
      c."content", c."pageNumber", c."sourceLabel",
      (1 - (c."embedding" <=> $1::vector))::float8 AS "semanticScore"
    FROM "DocumentChunk" c
    JOIN "Document" d ON d."id" = c."documentId"
    WHERE ${filterSql()} AND c."embedding" IS NOT NULL
    ORDER BY c."embedding" <=> $1::vector
    LIMIT $9`,
    vector,
    ...filterParams(userId, filters),
    limit,
  );
}

export async function searchByKeyword(userId: string, query: string, filters: SearchFilters, limit: number) {
  const terms = extractKeywordTerms(query);
  if (!terms.length) return [];

  const titleExpression = normalizedSql(`coalesce(d."title", '')`);
  const contentExpression = normalizedSql(`coalesce(c."content", '')`);
  const termPlaceholders = terms.map((_, index) => `$${9 + index}::text`);
  const scoreSql = termPlaceholders
    .map((placeholder) => `(CASE WHEN ${titleExpression} LIKE ${placeholder} THEN 2 ELSE 0 END + CASE WHEN ${contentExpression} LIKE ${placeholder} THEN 1 ELSE 0 END)`)
    .join(" + ");
  const phraseBonusSql = `(CASE WHEN ${titleExpression} LIKE $1::text THEN 3 WHEN ${contentExpression} LIKE $1::text THEN 1.5 ELSE 0 END)`;
  const matchSql = termPlaceholders
    .map((placeholder) => `(${titleExpression} LIKE ${placeholder} OR ${contentExpression} LIKE ${placeholder})`)
    .join(" OR ");
  const limitPlaceholder = `$${9 + terms.length}`;

  return db.$queryRawUnsafe<KeywordRow[]>(
    `SELECT c."id" AS "chunkId", d."id" AS "documentId", d."title",
      d."fileType"::text AS "fileType", d."primaryTopic", d."difficulty"::text AS "difficulty",
      c."content", c."pageNumber", c."sourceLabel", (${scoreSql} + ${phraseBonusSql})::float8 AS "keywordScore"
    FROM "DocumentChunk" c
    JOIN "Document" d ON d."id" = c."documentId"
    WHERE ${filterSql()} AND (${matchSql})
    ORDER BY "keywordScore" DESC, c."chunkIndex" ASC
    LIMIT ${limitPlaceholder}`,
    `%${normalizeSearchText(query)}%`,
    ...filterParams(userId, filters),
    ...terms.map((term) => `%${normalizeSearchText(term)}%`),
    limit,
  );
}

export async function hybridSearch(userId: string, query: string, filters: SearchFilters) {
  const candidateLimit = 30;
  const [vectorAttempt, keywordAttempt] = await Promise.allSettled([
    searchByVector(userId, query, filters, candidateLimit),
    searchByKeyword(userId, query, filters, candidateLimit),
  ]);
  const vectorCandidates = vectorAttempt.status === "fulfilled" ? vectorAttempt.value : [];
  const keywordCandidates = keywordAttempt.status === "fulfilled" ? keywordAttempt.value : [];

  if (!vectorCandidates.length && !keywordCandidates.length) {
    const errors = [vectorAttempt, keywordAttempt]
      .filter((attempt): attempt is PromiseRejectedResult => attempt.status === "rejected")
      .map((attempt) => attempt.reason instanceof Error ? attempt.reason.message : String(attempt.reason));
    if (errors.length) throw new Error(errors.join("; "));
  }

  return {
    candidates: rankSearchCandidates(
      vectorCandidates,
      keywordCandidates,
      candidateLimit,
      inferSearchCriteria(query),
    ),
    retrievalMode: vectorCandidates.length && keywordCandidates.length
      ? "hybrid"
      : vectorCandidates.length
        ? "semantic"
        : "keyword",
  } as const;
}
