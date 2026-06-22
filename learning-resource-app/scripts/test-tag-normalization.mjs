import assert from "node:assert/strict";
import { normalizeTagName } from "../src/lib/taxonomy/normalize-tag.ts";

const cases = [
  [" Retrieval-Augmented   Generation! ", "retrieval augmented generation"],
  ["Học máy & Dữ liệu", "hoc may and du lieu"],
  ["ĐIỆN TOÁN ĐÁM MÂY", "dien toan dam may"],
  ["Node.js / TypeScript", "node js typescript"],
  ["C++", "cpp"],
  ["C#", "c sharp"],
  [".NET Framework", "dotnet framework"],
  ["ＡＩ", "ai"],
];

for (const [input, expected] of cases) {
  assert.equal(normalizeTagName(input), expected, input);
}

assert.equal(normalizeTagName("   "), "");
console.log(`PASS tag normalization: ${cases.length} variants`);
