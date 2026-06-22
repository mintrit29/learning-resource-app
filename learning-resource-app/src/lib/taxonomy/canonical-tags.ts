import { db } from "@/lib/db";
import { normalizeTagName } from "@/lib/taxonomy/normalize-tag";

export async function findExactCanonicalTag(userId: string, name: string) {
  const normalizedName = normalizeTagName(name);
  if (!normalizedName) return null;

  return db.tag.findUnique({
    where: {
      createdByUserId_normalizedName: { createdByUserId: userId, normalizedName },
    },
  });
}

export async function findCanonicalTagByAlias(userId: string, alias: string) {
  const normalizedAlias = normalizeTagName(alias);
  if (!normalizedAlias) return null;

  const match = await db.tagAlias.findFirst({
    where: {
      normalizedAlias,
      tag: { createdByUserId: userId },
    },
    include: { tag: true },
    orderBy: { createdAt: "asc" },
  });
  return match?.tag ?? null;
}

export async function findExactTagOrAlias(userId: string, name: string) {
  return (await findExactCanonicalTag(userId, name)) ?? findCanonicalTagByAlias(userId, name);
}
