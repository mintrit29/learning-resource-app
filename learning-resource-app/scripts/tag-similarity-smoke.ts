import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { normalizeTagName } from "../src/lib/taxonomy/normalize-tag";
import { embedCanonicalTags, findSimilarCanonicalTags } from "../src/lib/taxonomy/tag-similarity";

const suffix = randomUUID();
const owner = await db.user.create({ data: { email: `similar-owner-${suffix}@example.test` } });
const other = await db.user.create({ data: { email: `similar-other-${suffix}@example.test` } });

try {
  const tags = await Promise.all([
    db.tag.create({ data: { name: "Machine Learning", normalizedName: normalizeTagName("Machine Learning"), createdByUserId: owner.id } }),
    db.tag.create({ data: { name: "Cooking Recipes", normalizedName: normalizeTagName("Cooking Recipes"), createdByUserId: owner.id } }),
    db.tag.create({ data: { name: "Deep Learning", normalizedName: normalizeTagName("Deep Learning"), createdByUserId: other.id } }),
  ]);

  assert.equal(await embedCanonicalTags(owner.id, tags.map((tag) => tag.id)), 2);
  assert.equal(await embedCanonicalTags(other.id, [tags[2].id]), 1);
  const matches = await findSimilarCanonicalTags(owner.id, "deep learning neural networks", 5);

  assert.equal(matches.length, 2);
  assert.equal(matches[0].name, "Machine Learning");
  assert(matches[0].score > matches[1].score);
  assert(!matches.some((match) => match.id === tags[2].id), "Must not leak another user's tags");
  console.log(`PASS tag similarity: ${matches[0].name} ranked first (${matches[0].score.toFixed(3)})`);
} finally {
  await db.user.deleteMany({ where: { id: { in: [owner.id, other.id] } } });
  await db.$disconnect();
}
