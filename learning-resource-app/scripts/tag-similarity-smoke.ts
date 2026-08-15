import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { normalizeTagName } from "../src/lib/taxonomy/normalize-tag";
import { embedCanonicalTags, findSimilarCanonicalTags } from "../src/lib/taxonomy/tag-similarity";

const suffix = randomUUID();
const tagIds: string[] = [];
try {
  const tags = await Promise.all([
    db.tag.create({ data: { name: `Machine Learning ${suffix}`, normalizedName: normalizeTagName(`Machine Learning ${suffix}`) } }),
    db.tag.create({ data: { name: `Cooking Recipes ${suffix}`, normalizedName: normalizeTagName(`Cooking Recipes ${suffix}`) } }),
    db.tag.create({ data: { name: `Deep Learning ${suffix}`, normalizedName: normalizeTagName(`Deep Learning ${suffix}`) } }),
  ]);
  tagIds.push(...tags.map((tag) => tag.id));

  assert.equal(await embedCanonicalTags(tags.map((tag) => tag.id)), 3);
  const matches = await findSimilarCanonicalTags("deep learning neural networks", 5);

  assert.ok(matches.length >= 2);
  assert(matches[0].score > matches[1].score);
  console.log(`PASS tag similarity: ${matches[0].name} ranked first (${matches[0].score.toFixed(3)})`);
} finally {
  await db.tag.deleteMany({ where: { id: { in: tagIds } } });
  await db.$disconnect();
}
