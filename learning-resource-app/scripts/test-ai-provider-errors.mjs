import assert from "node:assert/strict";
import {
  AiProviderError,
  aiHttpError,
  safeAiErrorMessage,
} from "../src/lib/ai/provider-errors.ts";

assert.equal(
  safeAiErrorMessage(aiHttpError(401), "fallback"),
  "API key không hợp lệ hoặc đã hết hạn.",
);
assert.equal(
  safeAiErrorMessage(aiHttpError(429), "fallback"),
  "Đã vượt giới hạn yêu cầu. Hãy thử lại sau.",
);
assert.equal(
  safeAiErrorMessage(new Error("TypeError: fetch failed; cause=ECONNREFUSED"), "fallback"),
  "Không kết nối được đến dịch vụ AI. Kiểm tra Base URL và dịch vụ đang chạy.",
);
assert.equal(
  safeAiErrorMessage(new TypeError("Invalid URL"), "fallback"),
  "Base URL không hợp lệ.",
);

const timeout = new Error("request aborted");
timeout.name = "AbortError";
assert.equal(
  safeAiErrorMessage(timeout, "fallback"),
  "Kết nối quá thời gian. Hãy thử lại.",
);

const invalidJson = new SyntaxError("Unexpected token < in <html> at position 0");
assert.equal(
  safeAiErrorMessage(invalidJson, "fallback"),
  "AI trả về dữ liệu không đúng định dạng. Hãy thử lại hoặc đổi model.",
);

const leakedError = new Error(
  "C:\\project\\src\\lib\\ai\\chat-provider.ts:123 <html><script>function secret(){}</script>",
);
const safeFallback = safeAiErrorMessage(leakedError, "Không thể kiểm tra kết nối AI.");
assert.equal(safeFallback, "Không thể kiểm tra kết nối AI.");
assert(!safeFallback.includes("chat-provider.ts"));
assert(!safeFallback.includes("<script>"));

const longTrustedMessage = new AiProviderError("x".repeat(500));
assert(safeAiErrorMessage(longTrustedMessage, "fallback").length <= 180);

console.log("PASS AI provider errors: short messages, common cases and no technical detail leaks");
