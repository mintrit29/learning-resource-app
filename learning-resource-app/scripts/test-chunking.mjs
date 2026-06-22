import assert from "node:assert/strict";
import { chunkDocumentSections, chunkDocumentText } from "../src/lib/documents/chunk-text.ts";

const words = Array.from({ length: 1200 }, (_, index) => `word-${index}`);
const chunks = chunkDocumentText(words.join(" "));

assert.ok(chunks.length >= 4, "Long text should create multiple chunks");
assert.equal(chunks[0].chunkIndex, 0);
assert.ok(chunks.every((chunk, index) => chunk.chunkIndex === index));
assert.ok(chunks.slice(0, -1).every((chunk) => chunk.tokenCount >= 300 && chunk.tokenCount <= 500));

for (let index = 1; index < chunks.length; index += 1) {
  const previousWords = chunks[index - 1].content.split(" ");
  const currentWords = chunks[index].content.split(" ");
  assert.deepEqual(previousWords.slice(-40), currentWords.slice(0, 40));
}

const coveredWords = new Set(chunks.flatMap((chunk) => chunk.content.split(" ")));
assert.equal(coveredWords.size, words.length, "Chunking must not lose source words");
console.log(`PASS chunking: ${words.length} words -> ${chunks.length} chunks`);

const locatedChunks = chunkDocumentSections([
  { text: words.slice(0, 500).join(" "), pageNumber: 7, sourceLabel: "Trang 7" },
  { text: words.slice(500).join(" "), pageNumber: 8, sourceLabel: "Trang 8" },
]);
assert.ok(locatedChunks.length > 2);
assert.ok(locatedChunks.filter((chunk) => chunk.pageNumber === 7).every((chunk) => chunk.sourceLabel === "Trang 7"));
assert.ok(locatedChunks.filter((chunk) => chunk.pageNumber === 8).every((chunk) => chunk.sourceLabel === "Trang 8"));
console.log("PASS source locations: page metadata preserved");
