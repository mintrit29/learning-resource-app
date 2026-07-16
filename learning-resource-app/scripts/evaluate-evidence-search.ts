import { db } from "../src/lib/db";
import { hybridSearch, searchByVector } from "../src/lib/search/hybrid-search";

const user = await db.user.findUniqueOrThrow({ where: { email: "demo@scholarflow.local" } });
const documents = await db.document.findMany({
  where: { userId: user.id, originalFileName: { in: ["evidence-search-database.pdf", "evidence-search-ml.pptx"] } },
  select: { id: true, originalFileName: true },
});
const documentIdByFile = new Map(documents.map((document) => [document.originalFileName, document.id]));
const databaseId = documentIdByFile.get("evidence-search-database.pdf");
const machineLearningId = documentIdByFile.get("evidence-search-ml.pptx");
if (!databaseId || !machineLearningId) throw new Error("Run npm run demo:seed-evidence before evaluation");

const cases = [
  ["transaction as a logical unit of work", databaseId],
  ["what happens when a transaction must roll back", databaseId],
  ["atomicity consistency isolation durability", databaseId],
  ["how ACID protects database data", databaseId],
  ["concurrent transaction isolation levels", databaseId],
  ["tai lieu nhap mon ve transaction", databaseId],
  ["giao dich co so du lieu la gi", databaseId],
  ["how database changes become durable", databaseId],
  ["correctness when transactions run together", databaseId],
  ["PDF database cho nguoi moi", databaseId],
  ["gradient boosting with weak decision trees", machineLearningId],
  ["how each tree corrects previous errors", machineLearningId],
  ["regularization for boosted models", machineLearningId],
  ["learning rate and tree depth hyperparameters", machineLearningId],
  ["reduce overfitting in gradient boosting", machineLearningId],
  ["slide machine learning nang cao", machineLearningId],
  ["mo hinh cay sua loi cua cay truoc", machineLearningId],
  ["sequential ensemble of decision trees", machineLearningId],
  ["boosted model overfit prevention", machineLearningId],
  ["advanced tree ensemble hyperparameters", machineLearningId],
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
for (const [query, expectedId] of cases) {
  let startedAt = Date.now();
  const baseline = await searchByVector(user.id, query, {}, 30);
  baselineRows.push(score(baseline.map((result) => result.documentId), expectedId, Date.now() - startedAt));

  startedAt = Date.now();
  const hybrid = await hybridSearch(user.id, query, {});
  hybridRows.push(score(hybrid.candidates.map((result) => result.documentId), expectedId, Date.now() - startedAt));
}

console.log(JSON.stringify({ queryCount: cases.length, baseline: average(baselineRows), hybrid: average(hybridRows) }, null, 2));
await db.$disconnect();

