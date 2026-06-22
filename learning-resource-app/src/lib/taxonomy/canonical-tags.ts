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
