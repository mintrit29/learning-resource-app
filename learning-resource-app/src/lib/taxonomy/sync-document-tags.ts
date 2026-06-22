import { DocumentTagSource, TagMergeReviewStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { embedTexts, toPgVector } from "@/lib/embedding/client";
import { findExactTagOrAlias } from "@/lib/taxonomy/canonical-tags";
import { normalizeTagName } from "@/lib/taxonomy/normalize-tag";

type Similar = { id: string; score: number };

export async function syncDocumentTags(documentId: string, userId: string, values: string[]) {
  await db.documentTag.deleteMany({ where: { documentId, source: { in: [DocumentTagSource.AI, DocumentTagSource.MERGED] } } });
  await db.tagMergeReview.deleteMany({ where: { documentId, status: TagMergeReviewStatus.PENDING } });

  for (const name of [...new Set(values.map((value) => value.trim()).filter(Boolean))]) {
    const normalizedName = normalizeTagName(name);
    const exact = await findExactTagOrAlias(userId, name);
    if (exact) {
      await db.documentTag.upsert({ where: { documentId_tagId: { documentId, tagId: exact.id } }, create: { documentId, tagId: exact.id, source: DocumentTagSource.AI }, update: { confidence: 1, source: DocumentTagSource.AI } });
      continue;
    }

    const embedded = await embedTexts([name]);
    const vector = toPgVector(embedded.embeddings[0]);
    const [similar] = await db.$queryRawUnsafe<Similar[]>(`SELECT "id", (1 - ("embedding" <=> $1::vector))::float8 AS "score" FROM "Tag" WHERE "createdByUserId" = $2 AND "embedding" IS NOT NULL ORDER BY "embedding" <=> $1::vector LIMIT 1`, vector, userId);

    if (similar?.score >= 0.9) {
      await db.$transaction([
        db.tagAlias.upsert({ where: { tagId_normalizedAlias: { tagId: similar.id, normalizedAlias: normalizedName } }, create: { tagId: similar.id, alias: name, normalizedAlias: normalizedName }, update: { alias: name } }),
        db.documentTag.upsert({ where: { documentId_tagId: { documentId, tagId: similar.id } }, create: { documentId, tagId: similar.id, confidence: similar.score, source: DocumentTagSource.MERGED }, update: { confidence: similar.score, source: DocumentTagSource.MERGED } }),
      ]);
    } else if (similar?.score >= 0.78) {
      const review = await db.tagMergeReview.create({ data: { userId, documentId, candidateTagName: name, candidateNormalizedName: normalizedName, suggestedTagId: similar.id, similarity: similar.score } });
      await db.$executeRawUnsafe('UPDATE "TagMergeReview" SET "candidateEmbedding" = $1::vector WHERE "id" = $2', vector, review.id);
    } else {
      const tag = await db.tag.create({ data: { name, normalizedName, createdByUserId: userId } });
      await db.$transaction([
        db.$executeRawUnsafe('UPDATE "Tag" SET "embedding" = $1::vector WHERE "id" = $2', vector, tag.id),
        db.documentTag.create({ data: { documentId, tagId: tag.id, source: DocumentTagSource.AI } }),
      ]);
    }
  }
}
