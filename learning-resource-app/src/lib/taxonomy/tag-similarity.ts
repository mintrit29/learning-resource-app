import { db } from "@/lib/db";
import { embedTexts, toPgVector } from "@/lib/embedding/client";

type SimilarTag = {
  id: string;
  name: string;
  normalizedName: string;
  score: number;
};

export async function embedCanonicalTags(userId: string, tagIds?: string[]) {
  const tags = await db.tag.findMany({
    where: {
      createdByUserId: userId,
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
    db.$executeRawUnsafe(
      'UPDATE "Tag" SET "embedding" = $1::vector WHERE "id" = $2 AND "createdByUserId" = $3',
      toPgVector(vector),
      tags[index].id,
      userId,
    ),
  ));
  return tags.length;
}

export async function findSimilarCanonicalTags(userId: string, name: string, limit = 5) {
  const query = name.trim();
  if (!query) return [];
  const safeLimit = Math.max(1, Math.min(20, Math.trunc(limit)));
  const embedded = await embedTexts([query]);
  const vector = toPgVector(embedded.embeddings[0]);

  return db.$queryRawUnsafe<SimilarTag[]>(
    `SELECT "id", "name", "normalizedName",
      (1 - ("embedding" <=> $1::vector))::float8 AS "score"
     FROM "Tag"
     WHERE "createdByUserId" = $2 AND "embedding" IS NOT NULL
     ORDER BY "embedding" <=> $1::vector
     LIMIT $3`,
    vector,
    userId,
    safeLimit,
  );
}
