import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Difficulty, DocumentStatus } from "../src/generated/prisma/enums";
import { db } from "../src/lib/db";

const outputPath = path.join(process.cwd(), "evaluation", "labels.json");
const maxDocuments = Number.parseInt(process.argv[2] ?? "60", 10);

const documents = await db.document.findMany({
  where: {
    status: DocumentStatus.READY,
    textContent: { not: null },
    chunks: { some: {} },
  },
  select: {
    id: true,
    title: true,
    originalFileName: true,
    primaryTopic: true,
    difficulty: true,
  },
  orderBy: { createdAt: "asc" },
  take: Number.isFinite(maxDocuments) ? Math.max(1, Math.min(60, maxDocuments)) : 60,
});

const template = {
  notes:
    "Manual ground-truth file for Week 11. Review and replace TODO values before running npm run eval:week11.",
  documents: documents.map((document) => ({
    documentId: document.id,
    title: document.title || document.originalFileName,
    expectedPrimaryTopic: document.primaryTopic ?? "TODO_TOPIC",
    expectedDifficulty: document.difficulty ?? Difficulty.BEGINNER,
    aiSuggestedTopic: document.primaryTopic,
    aiSuggestedDifficulty: document.difficulty,
    notes: "TODO: human-reviewed label",
  })),
  searchQueries: [
    {
      id: "q01",
      query: "TODO: query about a specific concept in the dataset",
      expectedDocumentIds: documents[0] ? [documents[0].id] : ["TODO_DOCUMENT_ID"],
      expectedChunkIds: [],
      notes: "TODO: human-reviewed relevant document/chunk ids",
    },
    {
      id: "q02",
      query: "TODO: another semantic search query",
      expectedDocumentIds: documents[1] ? [documents[1].id] : ["TODO_DOCUMENT_ID"],
      expectedChunkIds: [],
      notes: "Add at least 10 queries total before final evaluation.",
    },
  ],
  tagAliases: [
    {
      canonical: "Machine Learning",
      aliases: ["ML", "machine learning", "máy học"],
      notes: "Edit these samples to match the dataset.",
    },
  ],
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(`${outputPath}.example-backup.json`, JSON.stringify(template, null, 2), "utf8");
await writeFile(outputPath, JSON.stringify(template, null, 2), "utf8");

console.log(`Created ${outputPath}`);
console.log(`Documents included: ${documents.length}`);
console.log("Manual step left for owner: review labels and add at least 10 search queries.");

await db.$disconnect();
