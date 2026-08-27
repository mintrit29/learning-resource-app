import { db } from "@/lib/db";
import { normalizeTagName } from "@/lib/taxonomy/normalize-tag";

export async function findExactCanonicalTag(name: string) {
  const normalizedName = normalizeTagName(name);
  if (!normalizedName) return null;

  return db.tag.findFirst({
    where: { normalizedName },
  });
}
