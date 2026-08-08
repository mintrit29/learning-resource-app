import { DocumentTagSource } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { embedTexts } from "@/lib/embedding/client";
import { findExactTagOrAlias } from "@/lib/taxonomy/canonical-tags";
import { normalizeTagName } from "@/lib/taxonomy/normalize-tag";
import {
  cosineSimilarity,
  fromSqliteVectorBlob,
  toSqliteVectorBlob,
} from "@/lib/vector/sqlite-vector-store";

type Similar = { id: string; score: number };

async function findClosestTag(userId: string, vector: number[]): Promise<Similar | undefined> {
  const tags = await db.tag.findMany({
    where: { createdByUserId: userId, embedding: { not: null } },
    select: { id: true, embedding: true },
  });

  return tags
    .map((tag) => ({
      id: tag.id,
      score: cosineSimilarity(vector, fromSqliteVectorBlob(tag.embedding as Uint8Array)),
    }))
    .sort((left, right) => right.score - left.score)[0];
}

export async function syncDocumentTags(documentId: string, userId: string, values: string[]) {
  await db.documentTag.deleteMany({
    where: {
      documentId,
      source: { in: [DocumentTagSource.AI, DocumentTagSource.MERGED] },
    },
  });
  for (const name of [...new Set(values.map((value) => value.trim()).filter(Boolean))]) {
    const normalizedName = normalizeTagName(name);
    const exact = await findExactTagOrAlias(userId, name);
    if (exact) {
      await db.documentTag.upsert({
        where: { documentId_tagId: { documentId, tagId: exact.id } },
        create: { documentId, tagId: exact.id, source: DocumentTagSource.AI },
        update: { confidence: 1, source: DocumentTagSource.AI },
      });
      continue;
    }

    const embedded = await embedTexts([name]);
    const vector = embedded.embeddings[0];
    const vectorBlob = toSqliteVectorBlob(vector);
    const similar = await findClosestTag(userId, vector);

    if (similar && similar.score >= 0.9) {
      await db.$transaction([
        db.tagAlias.upsert({
          where: {
            tagId_normalizedAlias: {
              tagId: similar.id,
              normalizedAlias: normalizedName,
            },
          },
          create: { tagId: similar.id, alias: name, normalizedAlias: normalizedName },
          update: { alias: name },
        }),
        db.documentTag.upsert({
          where: { documentId_tagId: { documentId, tagId: similar.id } },
          create: {
            documentId,
            tagId: similar.id,
            confidence: similar.score,
            source: DocumentTagSource.MERGED,
          },
          update: { confidence: similar.score, source: DocumentTagSource.MERGED },
        }),
      ]);
    } else {
      const tag = await db.tag.create({
        data: {
          name,
          normalizedName,
          createdByUserId: userId,
          embedding: vectorBlob,
        },
      });
      await db.documentTag.create({
        data: { documentId, tagId: tag.id, source: DocumentTagSource.AI },
      });
    }
  }
}
