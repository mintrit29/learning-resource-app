import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { findExactCanonicalTag } from "../src/lib/taxonomy/canonical-tags";
import { normalizeTagName } from "../src/lib/taxonomy/normalize-tag";

const suffix = randomUUID();
const owner = await db.user.create({
  data: { email: `tag-owner-${suffix}@example.test`, name: "Tag smoke owner" },
});
const otherUser = await db.user.create({
  data: { email: `tag-other-${suffix}@example.test`, name: "Tag smoke other" },
});

try {
  const tag = await db.tag.create({
    data: {
      name: "Retrieval Augmented Generation",
      normalizedName: normalizeTagName("Retrieval Augmented Generation"),
      createdByUserId: owner.id,
    },
  });

  assert.equal((await findExactCanonicalTag(owner.id, " retrieval-augmented  generation "))?.id, tag.id);
  assert.equal(await findExactCanonicalTag(owner.id, "RAG"), null);
  assert.equal(await findExactCanonicalTag(otherUser.id, tag.name), null);
  assert.equal(await findExactCanonicalTag(owner.id, "   "), null);
  console.log("PASS exact canonical tag lookup: normalized, scoped, empty-safe");
} finally {
  await db.user.deleteMany({ where: { id: { in: [owner.id, otherUser.id] } } });
  await db.$disconnect();
}
