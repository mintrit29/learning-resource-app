import assert from "node:assert/strict";
import { createServer } from "node:http";
import { completeChat, listProviderModels, testProviderConnection } from "../src/lib/ai/chat-provider";
import { encryptApiKey } from "../src/lib/ai/provider-config";

process.env.AI_PROVIDER_ENCRYPTION_KEY = "provider-smoke-test-key";

const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : null;

  response.setHeader("Content-Type", "application/json");
  if (request.url === "/models") {
    assert.equal(request.headers.authorization, "Bearer test-key");
    response.end(JSON.stringify({ data: [{ id: "mock-chat-model" }] }));
    return;
  }
  if (request.url === "/chat/completions") {
    assert.equal(request.headers.authorization, "Bearer test-key");
    assert.equal(body.model, "mock-chat-model");
    response.end(JSON.stringify({ choices: [{ message: { content: "OK" } }] }));
    return;
  }
  if (request.url === "/api/tags") {
    response.end(JSON.stringify({ models: [{ name: "mock-ollama-model" }] }));
    return;
  }
  if (request.url === "/api/chat") {
    assert.equal(body.model, "mock-ollama-model");
    assert.equal(body.stream, false);
    response.end(JSON.stringify({ message: { content: "OK" } }));
    return;
  }
  response.statusCode = 404;
  response.end(JSON.stringify({ error: "not found" }));
});

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const apiKeyEncrypted = encryptApiKey("test-key");
  for (const type of ["OPENROUTER", "CUSTOM"] as const) {
    const config = { type, baseUrl, apiKeyEncrypted, defaultChatModel: "mock-chat-model" };
    assert.deepEqual(await listProviderModels(config), ["mock-chat-model"]);
    assert.equal(await testProviderConnection(config), "Kết nối model thành công");
    assert.equal(await completeChat(config, [{ role: "user", content: "test" }]), "OK");
  }

  const ollama = {
    type: "OLLAMA",
    baseUrl,
    apiKeyEncrypted: null,
    defaultChatModel: "mock-ollama-model",
  };
  assert.deepEqual(await listProviderModels(ollama), ["mock-ollama-model"]);
  assert.equal(await testProviderConnection(ollama), "Kết nối Ollama thành công");
  assert.equal(await completeChat(ollama, [{ role: "user", content: "test" }]), "OK");

  console.log("AI provider smoke test passed: OpenRouter, Ollama, Custom API");
} finally {
  server.close();
}
