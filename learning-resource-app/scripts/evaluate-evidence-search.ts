import { db } from "../src/lib/db";
import { hybridSearch, searchByVector } from "../src/lib/search/hybrid-search";

const fixtureFiles = [
  "evidence-search-database.pdf",
  "evidence-search-ml.pptx",
  "evidence-search-research-methods.pdf",
  "evidence-search-rest-api.pptx",
  "evidence-search-data-structures.epub",
  "evidence-search-threat-modeling.docx",
] as const;
const documents = await db.document.findMany({
  where: { originalFileName: { in: [...fixtureFiles] } },
  select: { id: true, originalFileName: true },
});
const documentIdByFile = new Map(documents.map((document) => [document.originalFileName, document.id]));
function documentId(fileName: typeof fixtureFiles[number]) {
  const id = documentIdByFile.get(fileName);
  if (!id) throw new Error(`Missing ${fileName}. Run npm run demo:seed-evidence before evaluation`);
  return id;
}

const databaseId = documentId("evidence-search-database.pdf");
const machineLearningId = documentId("evidence-search-ml.pptx");
const researchMethodsId = documentId("evidence-search-research-methods.pdf");
const restApiId = documentId("evidence-search-rest-api.pptx");
const dataStructuresId = documentId("evidence-search-data-structures.epub");
const threatModelingId = documentId("evidence-search-threat-modeling.docx");

const cases = [
  ["transaction as a logical unit of work", databaseId],
  ["what happens when a transaction must roll back", databaseId],
  ["atomicity consistency isolation durability", databaseId],
  ["how ACID protects database data", databaseId],
  ["concurrent transaction isolation levels", databaseId],
  ["giao dich co so du lieu la gi", databaseId],
  ["gradient boosting with weak decision trees", machineLearningId],
  ["how each tree corrects previous errors", machineLearningId],
  ["regularization for boosted models", machineLearningId],
  ["learning rate and tree depth hyperparameters", machineLearningId],
  ["reduce overfitting in gradient boosting", machineLearningId],
  ["mo hinh cay sua loi cua cay truoc", machineLearningId],
  ["how to find a research gap in previous studies", researchMethodsId],
  ["cach danh gia nguon hoc thuat dang tin cay", researchMethodsId],
  ["literature review for a student project", researchMethodsId],
  ["focused research question and project scope", researchMethodsId],
  ["HTTP methods for REST resources", restApiId],
  ["API error response and status code", restApiId],
  ["bao mat API bang authentication va rate limiting", restApiId],
  ["idempotency in production APIs", restApiId],
  ["difference between stack and queue", dataStructuresId],
  ["cau truc du lieu cho nguoi moi", dataStructuresId],
  ["breadth first search uses which structure", dataStructuresId],
  ["array versus linked list insertion", dataStructuresId],
  ["STRIDE threat categories", threatModelingId],
  ["xac dinh trust boundary va attack entry point", threatModelingId],
  ["prioritize security risk by likelihood and impact", threatModelingId],
  ["advanced DOCX about threat modeling", threatModelingId],
] as const;

const negativeCases = [
  "tôi tìm khóa học trung cấp",
  "khóa học nấu ăn cho người mới",
  "dự báo thời tiết ngày mai",
  "lịch thi đấu bóng đá tối nay",
  "hướng dẫn chăm sóc cây cảnh",
  "giá vé máy bay đi Hà Nội",
  "công thức làm bánh chocolate",
  "review điện thoại mới nhất",
  "tìm việc làm bán thời gian",
  "địa điểm du lịch gần biển",
] as const;

type Metrics = { precisionAt5: number; recallAt5: number; reciprocalRank: number; latencyMs: number };

function score(documentIds: string[], expectedId: string, latencyMs: number): Metrics {
  const uniqueIds = [...new Set(documentIds)].slice(0, 5);
  const rank = uniqueIds.indexOf(expectedId);
  return {
    precisionAt5: rank >= 0 ? 1 / Math.max(1, uniqueIds.length) : 0,
    recallAt5: rank >= 0 ? 1 : 0,
    reciprocalRank: rank >= 0 ? 1 / (rank + 1) : 0,
    latencyMs,
  };
}

function average(rows: Metrics[]) {
  const sum = rows.reduce((totals, row) => ({
    precisionAt5: totals.precisionAt5 + row.precisionAt5,
    recallAt5: totals.recallAt5 + row.recallAt5,
    reciprocalRank: totals.reciprocalRank + row.reciprocalRank,
    latencyMs: totals.latencyMs + row.latencyMs,
  }), { precisionAt5: 0, recallAt5: 0, reciprocalRank: 0, latencyMs: 0 });
  return Object.fromEntries(Object.entries(sum).map(([key, value]) => [key, Number((value / rows.length).toFixed(3))]));
}

const baselineRows: Metrics[] = [];
const hybridRows: Metrics[] = [];
const hybridFailures: Array<{ query: string; returned: string[] }> = [];
const positiveBestScores: Array<{
  query: string;
  score: number;
  semanticScore: number | null;
  keywordScore: number | null;
  top: Array<{ title: string; score: number }>;
}> = [];
for (const [query, expectedId] of cases) {
  let startedAt = Date.now();
  const baseline = await searchByVector(query, {}, 30);
  baselineRows.push(score(baseline.map((result) => result.documentId), expectedId, Date.now() - startedAt));

  startedAt = Date.now();
  const hybrid = await hybridSearch(query, {});
  const hybridDocumentIds = hybrid.candidates.map((result) => result.documentId);
  positiveBestScores.push({
    query,
    score: hybrid.candidates[0]?.score ?? 0,
    semanticScore: hybrid.candidates[0]?.semanticScore ?? null,
    keywordScore: hybrid.candidates[0]?.keywordScore ?? null,
    top: hybrid.candidates.slice(0, 5).map((result) => ({ title: result.title, score: Number(result.score.toFixed(3)) })),
  });
  hybridRows.push(score(hybridDocumentIds, expectedId, Date.now() - startedAt));
  if (!hybridDocumentIds.includes(expectedId)) {
    hybridFailures.push({
      query,
      returned: hybrid.candidates.slice(0, 3).map((result) => `${result.title} (${result.score.toFixed(3)})`),
    });
  }
}

const negativeResults = [];
for (const query of negativeCases) {
  const hybrid = await hybridSearch(query, {});
  negativeResults.push({
    query,
    accepted: hybrid.candidates.length > 0,
    top: hybrid.candidates.slice(0, 3).map((result) => ({
      title: result.title,
      score: Number(result.score.toFixed(3)),
      semanticScore: result.semanticScore == null ? null : Number(result.semanticScore.toFixed(3)),
      keywordScore: result.keywordScore == null ? null : Number(result.keywordScore.toFixed(3)),
    })),
  });
}

console.log(JSON.stringify({
  queryCount: cases.length,
  baseline: average(baselineRows),
  hybrid: average(hybridRows),
  hybridFailures,
  positiveBestScoreRange: {
    min: Number(Math.min(...positiveBestScores.map((result) => result.score)).toFixed(3)),
    max: Number(Math.max(...positiveBestScores.map((result) => result.score)).toFixed(3)),
  },
  lowestPositiveResults: [...positiveBestScores]
    .sort((left, right) => left.score - right.score)
    .slice(0, 5)
    .map((result) => ({
      ...result,
      score: Number(result.score.toFixed(3)),
      semanticScore: result.semanticScore == null ? null : Number(result.semanticScore.toFixed(3)),
      keywordScore: result.keywordScore == null ? null : Number(result.keywordScore.toFixed(3)),
    })),
  negativeQueryCount: negativeCases.length,
  negativeRejectionRate: Number((negativeResults.filter((result) => !result.accepted).length / negativeResults.length).toFixed(3)),
  negativeResults,
}, null, 2));
await db.$disconnect();
