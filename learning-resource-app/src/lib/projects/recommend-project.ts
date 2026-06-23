import { completeChat } from "@/lib/ai/chat-provider";
import { db } from "@/lib/db";
import { embedTexts, toPgVector } from "@/lib/embedding/client";
import { normalizeTagName } from "@/lib/taxonomy/normalize-tag";

type ChunkCandidate = {
  chunkId: string;
  documentId: string;
  content: string;
  semanticScore: number;
};

type RankedDocument = {
  documentId: string;
  title: string;
  primaryTopic: string | null;
  difficulty: string | null;
  tags: string[];
  bestChunkId: string;
  excerpt: string;
  semanticScore: number;
  topicScore: number;
  difficultyScore: number;
  tagScore: number;
  score: number;
};

function words(value: string) {
  return new Set(normalizeTagName(value).split(" ").filter((word) => word.length > 1));
}

function overlap(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  let matches = 0;
  for (const value of left) if (right.has(value)) matches += 1;
  return matches / Math.min(left.size, right.size);
}

function parseReasons(value: string) {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  const parsed = JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned) as Array<{ documentId?: string; reason?: string }>;
  return new Map(parsed.filter((item) => item.documentId && item.reason).map((item) => [item.documentId!, item.reason!.trim()]));
}

function fallbackReason(item: RankedDocument) {
  const parts = [`Nội dung gần với đề tài (${Math.round(item.semanticScore * 100)}% tương đồng)`];
  if (item.difficultyScore) parts.push("phù hợp độ khó mục tiêu");
  if (item.tags.length) parts.push(`liên quan các tag ${item.tags.slice(0, 3).join(", ")}`);
  return `${parts.join(", ")}.`;
}

export async function generateProjectRecommendations(projectId: string, userId: string, useLlm = true) {
  const project = await db.project.findFirstOrThrow({ where: { id: projectId, userId } });
  const query = [project.title, project.description, project.keywords.join(", ")].filter(Boolean).join("\n");
  const embedded = await embedTexts([query]);
  const vector = toPgVector(embedded.embeddings[0]);
  await db.$executeRawUnsafe('UPDATE "Project" SET "embedding" = $1::vector WHERE "id" = $2', vector, project.id);

  const chunks = await db.$queryRawUnsafe<ChunkCandidate[]>(
    `SELECT c."id" AS "chunkId", c."documentId", c."content",
      (1 - (c."embedding" <=> $1::vector))::float8 AS "semanticScore"
    FROM "DocumentChunk" c
    JOIN "Document" d ON d."id" = c."documentId"
    WHERE d."userId" = $2 AND d."status" = 'READY' AND c."embedding" IS NOT NULL
    ORDER BY c."embedding" <=> $1::vector
    LIMIT 80`,
    vector,
    userId,
  );

  const grouped = new Map<string, ChunkCandidate[]>();
  for (const chunk of chunks) grouped.set(chunk.documentId, [...(grouped.get(chunk.documentId) ?? []), chunk]);
  const documents = await db.document.findMany({
    where: { id: { in: [...grouped.keys()] }, userId },
    select: { id: true, title: true, primaryTopic: true, difficulty: true, keywords: true, tags: { select: { tag: { select: { name: true, normalizedName: true } } } } },
  });

  const projectWords = words(`${project.title} ${project.description} ${project.keywords.join(" ")}`);
  const keywordTags = new Set(project.keywords.map(normalizeTagName));
  const ranked: RankedDocument[] = documents.map((document) => {
    const matches = grouped.get(document.id)!;
    const best = matches[0];
    const semanticScore = Math.max(0, Math.min(1, best.semanticScore));
    const topicScore = overlap(projectWords, words(`${document.primaryTopic ?? ""} ${document.keywords.join(" ")}`));
    const difficultyScore = project.targetDifficulty && document.difficulty === project.targetDifficulty ? 1 : 0;
    const tagScore = document.tags.length ? document.tags.filter(({ tag }) => keywordTags.has(tag.normalizedName) || overlap(projectWords, words(tag.name)) > 0).length / document.tags.length : 0;
    return {
      documentId: document.id,
      title: document.title,
      primaryTopic: document.primaryTopic,
      difficulty: document.difficulty,
      tags: document.tags.map(({ tag }) => tag.name),
      bestChunkId: best.chunkId,
      excerpt: best.content.slice(0, 500),
      semanticScore,
      topicScore,
      difficultyScore,
      tagScore,
      score: semanticScore * 0.65 + topicScore * 0.15 + difficultyScore * 0.1 + tagScore * 0.1,
    };
  }).sort((a, b) => b.score - a.score).slice(0, 8);

  let reasons = new Map<string, string>();
  const provider = await db.aiProvider.findFirst({ where: { userId, isActive: true }, orderBy: { updatedAt: "desc" } });
  if (useLlm && provider && ranked.length) {
    try {
      const response = await completeChat(provider, [
        { role: "system", content: "Viết lý do gợi ý học liệu ngắn gọn, trung thực. Chỉ trả về JSON array hợp lệ." },
        { role: "user", content: `Đề tài: ${project.title}\nMô tả: ${project.description}\nĐộ khó: ${project.targetDifficulty ?? "không giới hạn"}\nHãy trả [{"documentId":"...","reason":"1-2 câu tiếng Việt"}] cho dữ liệu:\n${JSON.stringify(ranked.map(({ documentId, title, primaryTopic, difficulty, tags, excerpt }) => ({ documentId, title, primaryTopic, difficulty, tags, excerpt })))}` },
      ]);
      reasons = parseReasons(response);
    } catch {
      // Recommendation vẫn hữu ích khi provider tạm thời không phản hồi.
    }
  }

  await db.$transaction(async (tx) => {
    await tx.recommendation.deleteMany({ where: { projectId: project.id } });
    if (ranked.length) await tx.recommendation.createMany({ data: ranked.map((item) => ({ projectId: project.id, documentId: item.documentId, bestChunkId: item.bestChunkId, score: item.score, reason: reasons.get(item.documentId) ?? fallbackReason(item) })) });
  });
  return ranked.length;
}
