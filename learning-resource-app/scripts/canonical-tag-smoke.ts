import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import {
  findCanonicalTagByAlias,
  findExactCanonicalTag,
  findExactTagOrAlias,
} from "../src/lib/taxonomy/canonical-tags";
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
  await db.tagAlias.create({
    data: {
      tagId: tag.id,
      alias: "RAG",
      normalizedAlias: normalizeTagName("RAG"),
    },
  });

  assert.equal((await findExactCanonicalTag(" retrieval-augmented  generation "))?.id, tag.id);
  assert.equal(await findExactCanonicalTag("RAG"), null);
  assert.equal((await findCanonicalTagByAlias(" rag "))?.id, tag.id);
  assert.equal((await findExactTagOrAlias("RAG"))?.id, tag.id);
  assert.equal((await findExactTagOrAlias(tag.name))?.id, tag.id);
  assert.equal(await findExactCanonicalTag("   "), null);
  console.log("PASS canonical and alias lookup: normalized and canonical-first");
} finally {
  if (tagId) await db.tag.deleteMany({ where: { id: tagId } });
  await db.$disconnect();
}
