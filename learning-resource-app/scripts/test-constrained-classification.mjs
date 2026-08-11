import assert from "node:assert/strict";
import { selectAllowedTopic } from "../src/lib/taxonomy/constrained-classification.ts";

const topics = [
  { id: "database", name: "Thiết kế và phát triển cơ sở dữ liệu" },
  { id: "network", name: "Hệ thống mạng" },
];

assert.equal(selectAllowedTopic(topics, "database", 0.9)?.id, "database");
assert.equal(selectAllowedTopic(topics, "database", 0.74), null);
assert.equal(selectAllowedTopic(topics, "ai-created-topic", 1), null);
assert.equal(selectAllowedTopic(topics, null, 1), null);

console.log("PASS constrained classification: existing ID only, confidence gate and unclassified fallback");
