import assert from "node:assert/strict";
import {
  extractKeywordTerms,
  inferSearchCriteria,
  normalizeSearchText,
  rankSearchCandidates,
} from "../src/lib/search/ranking.ts";

assert.equal(normalizeSearchText("  Tìm hiểu Cơ sở DỮ LIỆU! "), "tim hieu co so du lieu");
assert.deepEqual(extractKeywordTerms("Tìm tài liệu về transaction trong database"), ["transaction", "database"]);
assert.deepEqual(extractKeywordTerms("cơ sở dữ liệu cho người mới"), []);
assert.deepEqual(inferSearchCriteria("Slide nhập môn SQL cho người mới"), {
  difficulty: "BEGINNER",
  fileType: "PPTX",
  keywords: ["slide", "nhap", "mon", "sql"],
});

const common = {
  documentId: "doc-1",
  title: "Database",
  fileType: "PDF",
  primaryTopic: "Database",
  difficulty: "BEGINNER",
  content: "Transaction and isolation",
  pageNumber: 2,
  sourceLabel: "Trang 2",
};
const ranked = rankSearchCandidates(
  [
    { ...common, chunkId: "semantic-only", semanticScore: 0.9 },
    { ...common, chunkId: "both", semanticScore: 0.82 },
  ],
  [
    { ...common, chunkId: "both", keywordScore: 5 },
    { ...common, chunkId: "keyword-only", keywordScore: 4 },
  ],
);

assert.equal(ranked[0].chunkId, "both");
assert.deepEqual(ranked[0].matchReasons, ["Khớp ngữ nghĩa", "Khớp từ khóa"]);
assert.ok(ranked.every((result) => result.score >= 0 && result.score <= 1));
assert.equal(new Set(ranked.map((result) => result.chunkId)).size, ranked.length);

console.log("PASS search ranking: normalization, intent, merge and score");
