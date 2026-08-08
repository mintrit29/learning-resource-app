import assert from "node:assert/strict";
import { createSequentialTaskQueue } from "../src/lib/documents/sequential-task-queue.ts";

const events = [];
let concurrentTasks = 0;
let maxConcurrentTasks = 0;
const queue = createSequentialTaskQueue(async (name) => {
  concurrentTasks += 1;
  maxConcurrentTasks = Math.max(maxConcurrentTasks, concurrentTasks);
  events.push(`start:${name}`);
  await new Promise((resolve) => setTimeout(resolve, 10));
  events.push(`end:${name}`);
  concurrentTasks -= 1;
});

const first = queue.enqueue("doc-1", "one");
const duplicate = queue.enqueue("doc-1", "duplicate");
const second = queue.enqueue("doc-2", "two");

assert.equal(first, duplicate, "Cùng documentId phải dùng lại tác vụ đang chờ");
assert.equal(queue.pendingCount(), 2);
await Promise.all([first, duplicate, second]);

assert.equal(maxConcurrentTasks, 1, "Hàng đợi không được chạy hai tài liệu cùng lúc");
assert.deepEqual(events, ["start:one", "end:one", "start:two", "end:two"]);
assert.equal(queue.pendingCount(), 0);
console.log("PASS document processing queue: sequential and deduplicated");
