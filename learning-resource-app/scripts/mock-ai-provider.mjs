import { createServer } from "node:http";

const port = Number(process.env.MOCK_AI_PORT ?? 18080);
const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  if (request.method === "GET" && request.url === "/api/tags") {
    response.end(JSON.stringify({ models: [{ name: "scholarflow-test" }] }));
    return;
  }
  if (request.method === "POST" && request.url === "/api/chat") {
    let body = "";
    for await (const chunk of request) body += chunk;
    const payload = JSON.parse(body);
    const prompt = payload.messages?.findLast?.((message) => message.role === "user")?.content ?? "";
    if (prompt.includes("READ_FIRST")) {
      const chunkIds = [...new Set(
        [...prompt.matchAll(/"chunkId":\s*"([^"]+)"/g)].map((match) => match[1]).filter((id) => id !== "id"),
      )];
      const curation = {
        summary: "Các đoạn về transaction và ACID trả lời trực tiếp câu hỏi.",
        items: chunkIds.map((chunkId, index) => ({
          chunkId,
          group: index === 0 ? "READ_FIRST" : "READ_LATER",
          reason: index === 0 ? "Giải thích trực tiếp khái niệm cần tìm." : "Cung cấp bằng chứng bổ sung.",
        })),
      };
      response.end(JSON.stringify({ message: { content: JSON.stringify(curation) } }));
      return;
    }

    const evidenceMarker = "Bằng chứng:\n";
    const evidence = JSON.parse(prompt.slice(prompt.indexOf(evidenceMarker) + evidenceMarker.length));
    const chunkId = evidence[0]?.chunkId ?? "missing";
    const content = evidence[0]?.content ?? "";
    const quote = content.slice(0, 180);
    const answer = {
      answer: "Theo tài liệu tìm được, transaction là một đơn vị công việc logic và các thuộc tính ACID giúp bảo vệ tính đúng đắn của dữ liệu.",
      citations: [{ chunkId, quote }],
      confidence: "HIGH",
      notEnoughEvidence: false,
    };
    response.end(JSON.stringify({ message: { content: JSON.stringify(answer) } }));
    return;
  }
  response.statusCode = 404;
  response.end(JSON.stringify({ message: "Not found" }));
});

server.listen(port, "0.0.0.0", () => console.log(`Mock AI provider listening on ${port}`));
