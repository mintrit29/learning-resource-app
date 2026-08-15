import { db } from "@/lib/db";
import { normalizeTagName } from "@/lib/taxonomy/normalize-tag";

export async function findExactCanonicalTag(name: string) {
  const normalizedName = normalizeTagName(name);
  if (!normalizedName) return null;

  return db.tag.findFirst({
    where: { normalizedName },
  });
}

export async function findCanonicalTagByAlias(alias: string) {
  const normalizedAlias = normalizeTagName(alias);
  if (!normalizedAlias) return null;

  const match = await db.tagAlias.findFirst({
    where: {
      normalizedAlias,
    },
    include: { tag: true },
    orderBy: { createdAt: "asc" },
  });
  return match?.tag ?? null;
}

export async function findExactTagOrAlias(name: string) {
  return (await findExactCanonicalTag(name)) ?? findCanonicalTagByAlias(name);
}
