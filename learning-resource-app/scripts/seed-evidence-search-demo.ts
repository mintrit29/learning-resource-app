import { db } from "../src/lib/db";
import { embedTexts } from "../src/lib/embedding/client";
import {
  getSqliteVectorStore,
  toSqliteVectorBlob,
} from "../src/lib/vector/sqlite-vector-store";

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
  {
    title: "Research Methods for Student Projects",
    originalFileName: "evidence-search-research-methods.pdf",
    fileType: "PDF" as const,
    primaryTopic: "Research Methods",
    difficulty: "INTERMEDIATE" as const,
    chunks: [
      "A strong research project begins with a focused research question that defines the population, problem, scope, and expected contribution.",
      "A literature review compares prior studies, identifies disagreements and research gaps, and explains how the new project extends existing knowledge.",
      "Academic sources should be evaluated by author expertise, publication venue, evidence quality, recency, and relevance before they are cited.",
    ],
  },
  {
    title: "Practical REST API Design",
    originalFileName: "evidence-search-rest-api.pptx",
    fileType: "PPTX" as const,
    primaryTopic: "Software Engineering",
    difficulty: "INTERMEDIATE" as const,
    chunks: [
      "REST APIs model resources with clear nouns in URLs and use HTTP methods such as GET, POST, PUT, PATCH, and DELETE consistently.",
      "Good API error responses use suitable HTTP status codes and return a stable machine-readable body with an error code and helpful message.",
      "Authentication, authorization, input validation, rate limiting, and idempotency protect production APIs from common failures and abuse.",
    ],
  },
  {
    title: "Data Structures Quick Guide",
    originalFileName: "evidence-search-data-structures.epub",
    fileType: "EPUB" as const,
    primaryTopic: "Computer Science",
    difficulty: "BEGINNER" as const,
    chunks: [
      "Arrays provide constant-time indexed access, while linked lists make insertion easier when the node position is already known.",
      "A stack follows last in first out and is useful for undo operations, expression evaluation, and depth-first traversal.",
      "A queue follows first in first out and is commonly used for task scheduling, buffering, and breadth-first search.",
    ],
  },
  {
    title: "Cybersecurity Threat Modeling Handbook",
    originalFileName: "evidence-search-threat-modeling.docx",
    fileType: "DOCX" as const,
    primaryTopic: "Cybersecurity",
    difficulty: "ADVANCED" as const,
    chunks: [
      "Threat modeling identifies valuable assets, trust boundaries, entry points, attackers, and possible abuse cases before implementation is complete.",
      "STRIDE classifies threats as spoofing, tampering, repudiation, information disclosure, denial of service, and elevation of privilege.",
      "Risk treatment prioritizes mitigations by likelihood and impact, then records accepted risks and verifies controls through security testing.",
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
          sourceLabel: fixture.fileType === "PDF"
            ? `Trang ${chunkIndex + 1}`
            : fixture.fileType === "PPTX"
              ? `Slide ${chunkIndex + 1}`
              : `Mục ${chunkIndex + 1}`,
        })),
      },
    },
    include: { chunks: true },
  });
  const embeddings = (await embedTexts(document.chunks.map((chunk) => chunk.content))).embeddings;
  for (const [index, chunk] of document.chunks.entries()) {
    getSqliteVectorStore().upsertChunkEmbedding(chunk.id, embeddings[index]);
    await db.documentChunk.update({
      where: { id: chunk.id },
      data: { embedding: toSqliteVectorBlob(embeddings[index]) },
    });
  }
}

console.log(`PASS evidence search demo seed: ${fixtures.length} documents for ${email}`);
await db.$disconnect();
