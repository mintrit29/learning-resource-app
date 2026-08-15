import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { decodeSearchRegionDataUrl } from "../src/lib/search/visual-search-input.ts";

const require = createRequire(import.meta.url);
const { normalizeCaptureRectangle } = require("../electron/visual-search.cjs");

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
assert.deepEqual(decodeSearchRegionDataUrl(`data:image/png;base64,${png.toString("base64")}`), png);
assert.throws(() => decodeSearchRegionDataUrl("data:image/svg+xml;base64,PHN2Zz4="), /PNG hoặc JPEG/);
assert.throws(() => decodeSearchRegionDataUrl("data:image/png;base64,SGVsbG8="), /không hợp lệ/);

assert.deepEqual(
  normalizeCaptureRectangle({ x: 10.4, y: 20.5, width: 100.2, height: 80.8 }, { width: 800, height: 600 }),
  { x: 10, y: 21, width: 100, height: 81 },
);
assert.throws(() => normalizeCaptureRectangle({ x: 0, y: 0, width: 5, height: 5 }, { width: 800, height: 600 }), /quá nhỏ/);
assert.throws(() => normalizeCaptureRectangle({ x: 750, y: 0, width: 100, height: 100 }, { width: 800, height: 600 }), /ngoài cửa sổ/);
assert.throws(() => normalizeCaptureRectangle({ x: 0, y: 0, width: 4000, height: 3000 }, { width: 5000, height: 5000 }), /quá lớn/);

console.log("Visual search input tests passed.");
