import assert from "node:assert/strict";
import {
  GIB,
  recommendLocalModels,
  recommendedLocalModelId,
} from "../src/lib/ai/local-model-catalog.ts";

function profile(totalMemoryGiB, freeDiskGiB, gpuMemoryGiB = null) {
  return {
    totalMemoryBytes: totalMemoryGiB * GIB,
    freeMemoryBytes: Math.max(2, totalMemoryGiB / 2) * GIB,
    freeDiskBytes: freeDiskGiB * GIB,
    maxGpuMemoryBytes: gpuMemoryGiB === null ? null : gpuMemoryGiB * GIB,
  };
}

assert.equal(recommendedLocalModelId(profile(8, 20)), "qwen3:1.7b");
assert.equal(recommendedLocalModelId(profile(16, 30)), "qwen3:4b-instruct");
assert.equal(recommendedLocalModelId(profile(16, 30, 8)), "qwen3:8b");
assert.equal(recommendedLocalModelId(profile(32, 50)), "qwen3:8b");

const lowDisk = recommendLocalModels(profile(32, 4));
assert.equal(
  lowDisk.find((model) => model.id === "qwen3:8b")?.fit,
  "insufficient-storage",
  "Model lớn phải bị chặn khi ổ đĩa không còn đủ khoảng trống an toàn",
);
assert.equal(
  lowDisk.filter((model) => model.fit === "recommended").length,
  1,
  "Mỗi cấu hình chỉ có một model được đánh dấu đề xuất",
);

console.log("PASS local AI recommendation: RAM, VRAM and disk safety thresholds");
