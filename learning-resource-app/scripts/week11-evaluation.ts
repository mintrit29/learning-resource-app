import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Difficulty } from "../src/generated/prisma/enums";
import { db } from "../src/lib/db";
import { embedTexts, toPgVector } from "../src/lib/embedding/client";
import { normalizeTagName } from "../src/lib/taxonomy/normalize-tag";

type DocumentLabel = {
  documentId: string;
  title?: string;
  expectedPrimaryTopic: string;
  expectedDifficulty: Difficulty | string;
  notes?: string;
};

type SearchQueryLabel = {
  id: string;
  query: string;
  expectedDocumentIds: string[];
  expectedChunkIds?: string[];
  notes?: string;
};

type TagAliasLabel = {
  canonical: string;
  aliases: string[];
  notes?: string;
};

type LabelFile = {
  notes?: string;
  documents: DocumentLabel[];
  searchQueries: SearchQueryLabel[];
  tagAliases?: TagAliasLabel[];
};

type SearchResult = {
  chunkId: string;
  documentId: string;
  title: string;
  pageNumber: number | null;
  score: number;
};

const labelPath = path.join(process.cwd(), "evaluation", "labels.json");
const resultDir = path.join(process.cwd(), "evaluation", "results");
const topK = Number.parseInt(process.env.EVAL_TOP_K ?? "5", 10);

function normalizeTopic(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("en");
}

function assertNoTodo(labels: LabelFile) {
  const raw = JSON.stringify(labels);
  if (raw.includes("TODO_") || raw.includes("TODO:")) {
    throw new Error(
      "evaluation/labels.json still contains TODO placeholders. Please finish the manual labels first.",
    );
  }
}

function accuracy(correct: number, total: number) {
  return total ? correct / total : 0;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function firstRelevantRank(results: SearchResult[], expectedDocumentIds: Set<string>, expectedChunkIds: Set<string>) {
  const index = results.findIndex((result) =>
    expectedChunkIds.has(result.chunkId) || expectedDocumentIds.has(result.documentId),
  );
  return index >= 0 ? index + 1 : null;
}

function recallAtK(results: SearchResult[], expectedDocumentIds: Set<string>, expectedChunkIds: Set<string>) {
  if (!expectedDocumentIds.size && !expectedChunkIds.size) return null;
  const matchedDocuments = new Set(
    results
      .filter((result) => expectedDocumentIds.has(result.documentId) || expectedChunkIds.has(result.chunkId))
      .map((result) => result.documentId),
  );
  if (expectedDocumentIds.size) {
    return matchedDocuments.size / expectedDocumentIds.size;
  }
  return results.some((result) => expectedChunkIds.has(result.chunkId)) ? 1 : 0;
}

async function semanticSearch(query: string, limit: number) {
  const embedded = await embedTexts([query]);
  const vector = toPgVector(embedded.embeddings[0]);
  return db.$queryRawUnsafe<SearchResult[]>(
    `SELECT
      c."id" AS "chunkId",
      d."id" AS "documentId",
      d."title",
      c."pageNumber",
      (1 - (c."embedding" <=> $1::vector))::float8 AS "score"
    FROM "DocumentChunk" c
    JOIN "Document" d ON d."id" = c."documentId"
    WHERE c."embedding" IS NOT NULL
    ORDER BY c."embedding" <=> $1::vector
    LIMIT $2`,
    vector,
    limit,
  );
}

async function keywordSearch(query: string, limit: number) {
  return db.$queryRawUnsafe<SearchResult[]>(
    `SELECT
      c."id" AS "chunkId",
      d."id" AS "documentId",
      d."title",
      c."pageNumber",
      ts_rank_cd(
        to_tsvector('simple', coalesce(d."title", '') || ' ' || coalesce(c."content", '')),
        plainto_tsquery('simple', $1)
      )::float8 AS "score"
    FROM "DocumentChunk" c
    JOIN "Document" d ON d."id" = c."documentId"
    WHERE to_tsvector('simple', coalesce(d."title", '') || ' ' || coalesce(c."content", ''))
      @@ plainto_tsquery('simple', $1)
    ORDER BY "score" DESC
    LIMIT $2`,
    query,
    limit,
  );
}

const labels = JSON.parse(await readFile(labelPath, "utf8")) as LabelFile;
assertNoTodo(labels);

const documentIds = labels.documents.map((label) => label.documentId);
const documents = await db.document.findMany({
  where: { id: { in: documentIds } },
  select: {
    id: true,
    title: true,
    primaryTopic: true,
    difficulty: true,
    status: true,
  },
});
const documentMap = new Map(documents.map((document) => [document.id, document]));

const classificationRows = labels.documents.map((label) => {
  const document = documentMap.get(label.documentId);
  const topicCorrect = normalizeTopic(document?.primaryTopic) === normalizeTopic(label.expectedPrimaryTopic);
  const difficultyCorrect = document?.difficulty === label.expectedDifficulty;
  return {
    documentId: label.documentId,
    title: label.title ?? document?.title ?? "",
    expectedPrimaryTopic: label.expectedPrimaryTopic,
    actualPrimaryTopic: document?.primaryTopic ?? null,
    topicCorrect,
    expectedDifficulty: label.expectedDifficulty,
    actualDifficulty: document?.difficulty ?? null,
    difficultyCorrect,
    status: document?.status ?? "MISSING",
  };
});

const topicCorrect = classificationRows.filter((row) => row.topicCorrect).length;
const difficultyCorrect = classificationRows.filter((row) => row.difficultyCorrect).length;

const searchRows = [];
for (const queryLabel of labels.searchQueries) {
  const expectedDocumentIds = new Set(queryLabel.expectedDocumentIds ?? []);
  const expectedChunkIds = new Set(queryLabel.expectedChunkIds ?? []);
  const [semanticResults, keywordResults] = await Promise.all([
    semanticSearch(queryLabel.query, topK),
    keywordSearch(queryLabel.query, topK),
  ]);
  const semanticRank = firstRelevantRank(semanticResults, expectedDocumentIds, expectedChunkIds);
  const keywordRank = firstRelevantRank(keywordResults, expectedDocumentIds, expectedChunkIds);
  searchRows.push({
    id: queryLabel.id,
    query: queryLabel.query,
    expectedDocumentIds: [...expectedDocumentIds],
    expectedChunkIds: [...expectedChunkIds],
    semanticTopK: semanticResults,
    keywordTopK: keywordResults,
    semanticRecallAtK: recallAtK(semanticResults, expectedDocumentIds, expectedChunkIds),
    keywordRecallAtK: recallAtK(keywordResults, expectedDocumentIds, expectedChunkIds),
    semanticFirstRelevantRank: semanticRank,
    keywordFirstRelevantRank: keywordRank,
    semanticMrr: semanticRank ? 1 / semanticRank : 0,
    keywordMrr: keywordRank ? 1 / keywordRank : 0,
  });
}

const tagAliasRows = (labels.tagAliases ?? []).flatMap((group) => {
  const canonicalNormalized = normalizeTagName(group.canonical);
  return group.aliases.map((alias) => ({
    canonical: group.canonical,
    alias,
    canonicalNormalized,
    aliasNormalized: normalizeTagName(alias),
    exactNormalizedMatch: normalizeTagName(alias) === canonicalNormalized,
    notes: group.notes ?? "",
  }));
});

const report = {
  generatedAt: new Date().toISOString(),
  topK,
  classification: {
    total: classificationRows.length,
    topicCorrect,
    difficultyCorrect,
    primaryTopicAccuracy: accuracy(topicCorrect, classificationRows.length),
    difficultyAccuracy: accuracy(difficultyCorrect, classificationRows.length),
    rows: classificationRows,
  },
  search: {
    totalQueries: searchRows.length,
    semanticMeanRecallAtK: average(searchRows.map((row) => row.semanticRecallAtK ?? 0)),
    keywordMeanRecallAtK: average(searchRows.map((row) => row.keywordRecallAtK ?? 0)),
    semanticMrr: average(searchRows.map((row) => row.semanticMrr)),
    keywordMrr: average(searchRows.map((row) => row.keywordMrr)),
    rows: searchRows,
  },
  tagAliases: {
    totalPairs: tagAliasRows.length,
    exactNormalizedMatches: tagAliasRows.filter((row) => row.exactNormalizedMatch).length,
    rows: tagAliasRows,
  },
};

const markdown = `# Week 11 Evaluation Report

Generated at: ${report.generatedAt}

## Classification

- Documents evaluated: ${report.classification.total}
- Primary topic accuracy: ${(report.classification.primaryTopicAccuracy * 100).toFixed(1)}%
- Difficulty accuracy: ${(report.classification.difficultyAccuracy * 100).toFixed(1)}%

## Search top-${topK}

- Queries evaluated: ${report.search.totalQueries}
- Semantic mean recall@${topK}: ${(report.search.semanticMeanRecallAtK * 100).toFixed(1)}%
- Keyword mean recall@${topK}: ${(report.search.keywordMeanRecallAtK * 100).toFixed(1)}%
- Semantic MRR: ${report.search.semanticMrr.toFixed(3)}
- Keyword MRR: ${report.search.keywordMrr.toFixed(3)}

## Tag/Alias samples

- Pairs checked: ${report.tagAliases.totalPairs}
- Exact normalized matches: ${report.tagAliases.exactNormalizedMatches}

See \`week11-evaluation-report.json\` for full per-document and per-query details.
`;

await mkdir(resultDir, { recursive: true });
await writeFile(path.join(resultDir, "week11-evaluation-report.json"), JSON.stringify(report, null, 2), "utf8");
await writeFile(path.join(resultDir, "week11-evaluation-report.md"), markdown, "utf8");

console.log(markdown);
await db.$disconnect();
