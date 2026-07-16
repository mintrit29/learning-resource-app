import { db } from "../src/lib/db";
import { embedTexts, toPgVector } from "../src/lib/embedding/client";

const email = "demo@scholarflow.local";
const user = await db.user.findUniqueOrThrow({ where: { email } });
const fixtures = [
  {
    title: "Database Transactions for Beginners",
    originalFileName: "evidence-search-database.pdf",
    fileType: "PDF" as const,
    primaryTopic: "Database",
    difficulty: "BEGINNER" as const,
    chunks: [
      "A database transaction is a sequence of operations treated as one logical unit of work. It either completes fully or rolls back.",
      "ACID means atomicity, consistency, isolation, and durability. These properties protect data when transactions run concurrently.",
      "Isolation levels control which changes one transaction can observe from another transaction, balancing correctness and performance.",
    ],
  },
  {
    title: "Advanced Machine Learning Slides",
    originalFileName: "evidence-search-ml.pptx",
    fileType: "PPTX" as const,
    primaryTopic: "Machine Learning",
    difficulty: "ADVANCED" as const,
    chunks: [
      "Gradient boosting combines weak decision trees sequentially so each new tree corrects errors made by the previous ensemble.",
      "Regularization, learning rate, and tree depth are key hyperparameters that reduce overfitting in gradient boosted models.",
    ],
  },
];

for (const fixture of fixtures) {
  const existing = await db.document.findFirst({
    where: { userId: user.id, originalFileName: fixture.originalFileName },
    select: { id: true },
  });
  if (existing) await db.document.delete({ where: { id: existing.id } });

  const document = await db.document.create({
    data: {
      userId: user.id,
      title: fixture.title,
      originalFileName: fixture.originalFileName,
      fileType: fixture.fileType,
      filePath: `demo/${fixture.originalFileName}`,
      fileSize: 2048,
      textContent: fixture.chunks.join("\n\n"),
      language: "en",
      primaryTopic: fixture.primaryTopic,
      difficulty: fixture.difficulty,
      summary: `Demo fixture for ${fixture.primaryTopic}`,
      status: "READY",
      chunks: {
        create: fixture.chunks.map((content, chunkIndex) => ({
          chunkIndex,
          content,
          pageNumber: fixture.fileType === "PDF" ? chunkIndex + 1 : null,
          sourceLabel: fixture.fileType === "PDF" ? `Trang ${chunkIndex + 1}` : `Slide ${chunkIndex + 1}`,
        })),
      },
    },
    include: { chunks: true },
  });
  const embeddings = (await embedTexts(document.chunks.map((chunk) => chunk.content))).embeddings;
  for (const [index, chunk] of document.chunks.entries()) {
    await db.$executeRawUnsafe(
      'UPDATE "DocumentChunk" SET "embedding" = $1::vector WHERE "id" = $2',
      toPgVector(embeddings[index]),
      chunk.id,
    );
  }
}

console.log(`PASS evidence search demo seed: ${fixtures.length} documents for ${email}`);
await db.$disconnect();

