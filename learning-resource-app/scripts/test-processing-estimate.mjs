import assert from "node:assert/strict";
import {
  estimateItemsPerMinuteFromSamples,
  estimateProcessingRemaining,
  formatRemainingDuration,
} from "../src/lib/documents/processing-estimate.ts";

const startedAt = new Date("2026-08-01T07:32:00.000Z");
const estimate = estimateProcessingRemaining({
  totalItems: 1703,
  completedItems: 180,
  startedAt,
  now: new Date("2026-08-01T07:55:00.000Z"),
});

assert.ok(estimate);
assert.ok(Math.abs(estimate.itemsPerMinute - 7.826) < 0.001);
assert.ok(Math.abs(estimate.remainingSeconds - 11676.33) < 0.01);
assert.equal(formatRemainingDuration(estimate.remainingSeconds), "còn khoảng 3 giờ 15 phút");

assert.equal(
  estimateProcessingRemaining({
    totalItems: 100,
    completedItems: 1,
    startedAt: new Date("2026-08-01T07:54:50.000Z"),
    now: new Date("2026-08-01T07:55:00.000Z"),
  }),
  null,
  "A very short sample should stay in the measuring state",
);

assert.equal(
  estimateProcessingRemaining({
    totalItems: 100,
    completedItems: 100,
    startedAt,
    now: new Date("2026-08-01T07:55:00.000Z"),
  }),
  null,
  "Completed work should not have a remaining-time estimate",
);

assert.equal(formatRemainingDuration(44), "còn khoảng 44 giây");
assert.equal(formatRemainingDuration(60 * 28), "còn khoảng 28 phút");
assert.equal(formatRemainingDuration(60 * 120), "còn khoảng 2 giờ");

assert.equal(
  estimateItemsPerMinuteFromSamples(
    { completedItems: 180, observedAt: "2026-08-01T07:55:00.000Z" },
    { completedItems: 188, observedAt: "2026-08-01T07:56:00.000Z" },
  ),
  8,
  "Two persisted progress timestamps should produce a retry-safe live rate",
);
assert.equal(
  estimateItemsPerMinuteFromSamples(
    { completedItems: 188, observedAt: "2026-08-01T07:56:00.000Z" },
    { completedItems: 188, observedAt: "2026-08-01T07:57:00.000Z" },
  ),
  null,
  "No new work must not create a fake throughput sample",
);

console.log("PASS processing estimate: live throughput and Vietnamese duration labels");
