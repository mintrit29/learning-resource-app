import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { embedTexts, toPgVector } from "../src/lib/embedding/client";
import { generateProjectRecommendations } from "../src/lib/projects/recommend-project";

const suffix = randomUUID();
const owner = await db.user.create({ data: { email: `project-smoke-${suffix}@example.test`, name: "Project smoke owner" } });
const seedText = "Database systems use transactions, locks, logs, and concurrency control to keep data consistent during simultaneous updates.";

try {
  const document = await db.document.create({
    data: {
      userId: owner.id,
      title: "Database transaction processing",
      originalFileName: "database-transactions.pdf",
      fileType: "PDF",
      filePath: "smoke/database-transactions.pdf",
      fileSize: 1024,
      textContent: seedText,
      language: "en",
      primaryTopic: "Database",
      difficulty: "INTERMEDIATE",
      keywords: ["Database", "Transactions", "Concurrency Control"],
      status: "READY",
    },
  });
  const chunk = await db.documentChunk.create({
    data: {
      documentId: document.id,
      chunkIndex: 0,
      content: seedText,
      pageNumber: 1,
      sourceLabel: "Trang 1",
    },
  });
  const [chunkEmbedding] = (await embedTexts([seedText])).embeddings;
  await db.$executeRawUnsafe('UPDATE "DocumentChunk" SET "embedding" = $1::vector WHERE "id" = $2', toPgVector(chunkEmbedding), chunk.id);

  const project = await db.project.create({
    data: {
      userId: owner.id,
      title: "Database systems and transaction processing",
      description: "Find learning resources about database transactions and concurrency control.",
      keywords: ["Database", "Transactions", "Concurrency Control"],
      targetDifficulty: "INTERMEDIATE",
    },
  });

  const count = await generateProjectRecommendations(project.id, owner.id, false);
  const saved = await db.recommendation.findMany({ where: { projectId: project.id }, orderBy: { score: "desc" } });
  if (!count || count !== saved.length) throw new Error(`Invalid recommendation count: generated=${count}, saved=${saved.length}`);
  if (saved.some((item) => !item.bestChunkId || !item.reason || item.score <= 0)) throw new Error("Recommendation is missing score, reason, or matched chunk");
  console.log(JSON.stringify({ status: "ok", recommendations: saved.length, topScore: saved[0]?.score }, null, 2));
} finally {
  await db.user.delete({ where: { id: owner.id } });
  await db.$disconnect();
}
