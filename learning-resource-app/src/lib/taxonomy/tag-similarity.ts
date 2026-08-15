import { db } from "@/lib/db";
import { embedTexts } from "@/lib/embedding/client";
import {
  cosineSimilarity,
  fromSqliteVectorBlob,
  toSqliteVectorBlob,
} from "@/lib/vector/sqlite-vector-store";

type SimilarTag = {
  id: string;
  name: string;
  normalizedName: string;
  score: number;
};

export async function embedCanonicalTags(tagIds?: string[]) {
  const tags = await db.tag.findMany({
    where: {
      ...(tagIds?.length ? { id: { in: tagIds } } : {}),
    },
    select: { id: true, name: true, description: true },
    orderBy: { createdAt: "asc" },
  });
  if (!tags.length) return 0;

  const result = await embedTexts(tags.map((tag) =>
    tag.description ? `${tag.name}: ${tag.description}` : tag.name
  ));
  await db.$transaction(result.embeddings.map((vector, index) =>
    db.tag.update({
      where: { id: tags[index].id },
      data: { embedding: toSqliteVectorBlob(vector) },
    }),
  ));
  return tags.length;
}

export async function findSimilarCanonicalTags(name: string, limit = 5) {
  const query = name.trim();
  if (!query) return [];
  const safeLimit = Math.max(1, Math.min(20, Math.trunc(limit)));
  const embedded = await embedTexts([query]);
  const tags = await db.tag.findMany({
    where: { embedding: { not: null } },
    select: { id: true, name: true, normalizedName: true, embedding: true },
  });

  return tags
    .map((tag): SimilarTag => ({
      id: tag.id,
      name: tag.name,
      normalizedName: tag.normalizedName,
      score: cosineSimilarity(
        embedded.embeddings[0],
        fromSqliteVectorBlob(tag.embedding as Uint8Array),
      ),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, safeLimit);
}
