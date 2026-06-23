import { db } from "../src/lib/db";
import { generateProjectRecommendations } from "../src/lib/projects/recommend-project";

const owner = await db.user.findFirst({
  where: { documents: { some: { status: "READY", chunks: { some: {} } } } },
  select: { id: true },
});

if (!owner) throw new Error("Cần ít nhất một user có tài liệu READY để chạy smoke test");

const project = await db.project.create({
  data: {
    userId: owner.id,
    title: "Database systems and transaction processing",
    description: "Tìm tài liệu phục vụ nghiên cứu database, transactions và concurrency control.",
    keywords: ["Database", "Transactions", "Concurrency Control"],
    targetDifficulty: "INTERMEDIATE",
  },
});

try {
  const count = await generateProjectRecommendations(project.id, owner.id, false);
  const saved = await db.recommendation.findMany({ where: { projectId: project.id }, orderBy: { score: "desc" } });
  if (!count || count !== saved.length) throw new Error(`Số recommendation không hợp lệ: generated=${count}, saved=${saved.length}`);
  if (saved.some((item) => !item.bestChunkId || !item.reason || item.score <= 0)) throw new Error("Recommendation thiếu score, reason hoặc matched chunk");
  console.log(JSON.stringify({ status: "ok", recommendations: saved.length, topScore: saved[0]?.score }, null, 2));
} finally {
  await db.project.delete({ where: { id: project.id } });
  await db.$disconnect();
}
