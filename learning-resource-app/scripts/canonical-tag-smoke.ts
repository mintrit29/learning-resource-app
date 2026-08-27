import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { findExactCanonicalTag } from "../src/lib/taxonomy/canonical-tags";
import { normalizeTagName } from "../src/lib/taxonomy/normalize-tag";

let tagId = "";
try {
  const tag = await db.tag.create({
    data: {
      name: "Retrieval Augmented Generation",
      normalizedName: normalizeTagName("Retrieval Augmented Generation"),
    },
  });
  tagId = tag.id;

  assert.equal((await findExactCanonicalTag(" retrieval-augmented  generation "))?.id, tag.id);
  assert.equal(await findExactCanonicalTag("RAG"), null);
  assert.equal(await findExactCanonicalTag("   "), null);
  console.log("PASS canonical tag lookup: normalized exact names");
} finally {
  if (tagId) await db.tag.deleteMany({ where: { id: tagId } });
  await db.$disconnect();
}
