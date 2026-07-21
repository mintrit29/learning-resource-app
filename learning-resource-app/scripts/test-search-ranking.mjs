import assert from "node:assert/strict";
import {
  extractKeywordTerms,
  extractKeywordGroups,
  inferQueryIntent,
  inferSearchCriteria,
  normalizeSearchText,
  rankSearchCandidates,
} from "../src/lib/search/ranking.ts";

assert.equal(normalizeSearchText("  Tìm hiểu Cơ sở DỮ LIỆU! "), "tim hieu co so du lieu");
assert.deepEqual(extractKeywordTerms("Tìm tài liệu về transaction trong database"), ["transaction", "database"]);
assert.deepEqual(extractKeywordGroups("cơ sở dữ liệu cho người mới"), [
  ["co so du lieu", "database", "databases"],
  ["nguoi moi", "beginner", "beginners", "intro", "introduction"],
]);
assert.deepEqual(inferSearchCriteria("Slide nhập môn SQL cho người mới"), {
  difficulty: "BEGINNER",
  fileType: "PPTX",
  keywords: ["nguoi moi", "beginner", "beginners", "intro", "introduction", "slide", "nhap", "mon", "sql"],
  keywordGroups: [
    ["nguoi moi", "beginner", "beginners", "intro", "introduction"],
    ["slide"],
    ["nhap"],
    ["mon"],
    ["sql"],
  ],
});
assert.equal(inferQueryIntent("database"), "DISCOVERY");
assert.equal(inferQueryIntent("AI machine learning"), "DISCOVERY");
assert.equal(inferQueryIntent("tôi tìm khóa học trung cấp"), "DISCOVERY");
assert.equal(inferQueryIntent("Data isolation là gì?"), "QUESTION");
assert.equal(inferQueryIntent("Explain database rollback"), "QUESTION");

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
  30,
  inferSearchCriteria("transaction"),
);

assert.equal(ranked[0].chunkId, "both");
assert.deepEqual(ranked[0].matchReasons, ["Khớp ngữ nghĩa", "Khớp từ khóa"]);
assert.ok(ranked.every((result) => result.score >= 0 && result.score <= 1));
assert.equal(new Set(ranked.map((result) => result.chunkId)).size, ranked.length);

const rejected = rankSearchCandidates(
  [{ ...common, chunkId: "weak-semantic", semanticScore: 0.46 }],
  [],
  30,
  inferSearchCriteria("tôi tìm khóa học trung cấp"),
);
assert.equal(rejected.length, 0, "Weak semantic-only matches must be rejected");

const wrongDifficulty = rankSearchCandidates(
  [{ ...common, chunkId: "beginner-course", title: "A Course in Machine Learning", content: "A course for students", semanticScore: 0.72 }],
  [{ ...common, chunkId: "beginner-course", title: "A Course in Machine Learning", content: "A course for students", keywordScore: 4 }],
  30,
  inferSearchCriteria("khóa học trung cấp"),
);
assert.equal(wrongDifficulty.length, 0, "Explicit difficulty must exclude mismatched documents");

const databaseCriteria = inferSearchCriteria("database");
const databaseResults = rankSearchCandidates(
  [
    { ...common, chunkId: "content", semanticScore: 0.7, content: "A database transaction can roll back safely." },
    { ...common, chunkId: "copyright", semanticScore: 0.72, content: "Copyright. This database book is licensed under Creative Commons." },
  ],
  [
    { ...common, chunkId: "content", keywordScore: 3, content: "A database transaction can roll back safely." },
    { ...common, chunkId: "copyright", keywordScore: 3, content: "Copyright. This database book is licensed under Creative Commons." },
  ],
  30,
  databaseCriteria,
);
assert.equal(databaseResults[0]?.chunkId, "content", "Useful content must outrank boilerplate");

console.log("PASS search ranking: query intent, bilingual concepts, relevance gate and boilerplate rerank");
