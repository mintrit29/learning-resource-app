import { NextResponse } from "next/server";
import { z } from "zod";
import { completeChat } from "@/lib/ai/chat-provider";
import { safeAiErrorMessage } from "@/lib/ai/provider-errors";
import { db } from "@/lib/db";

const resultSchema = z.object({
  chunkId: z.string().trim().min(1),
  documentId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(300),
  fileType: z.string().trim().max(20),
  primaryTopic: z.string().nullable().optional(),
  difficulty: z.string().nullable().optional(),
  content: z.string().trim().min(1).max(5000),
  pageNumber: z.number().nullable().optional(),
  sourceLabel: z.string().nullable().optional(),
  score: z.number().min(0).max(1),
});

const curateRequestSchema = z.object({
  query: z.string().trim().min(2).max(500),
  results: z.array(resultSchema).min(1).max(12),
});

const curatedItemSchema = z.object({
  chunkId: z.string(),
  group: z.enum(["READ_FIRST", "READ_LATER", "SKIP"]),
  reason: z.string().trim().min(1).max(220),
});

const curatedResponseSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  items: z.array(curatedItemSchema).min(1).max(12),
});

function parseJson(value: string) {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned) as unknown;
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = curateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dữ liệu gợi ý không hợp lệ" }, { status: 400 });
  }

  const provider = await db.aiProvider.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!provider) {
    return NextResponse.json(
      { message: "Chưa có AI provider đang hoạt động. Hãy bật provider trong Cài đặt trước." },
      { status: 400 },
    );
  }

  try {
    const compactResults = parsed.data.results.map((result, index) => ({
      index: index + 1,
      chunkId: result.chunkId,
      title: result.title,
      fileType: result.fileType,
      topic: result.primaryTopic,
      difficulty: result.difficulty,
      location: result.sourceLabel ?? (result.pageNumber ? `Trang ${result.pageNumber}` : null),
      matchPercent: Math.round(result.score * 100),
      excerpt: result.content.slice(0, 1200),
    }));

    const response = await completeChat(provider, [
      {
        role: "system",
        content:
          "Bạn là trợ lý học tập. Hãy lọc kết quả tìm kiếm theo nhu cầu người học. Chỉ trả về một JSON object hợp lệ, không markdown.",
      },
      {
        role: "user",
        content: `Người dùng cần tìm: ${parsed.data.query}

Hãy đọc các kết quả semantic search bên dưới và phân loại từng kết quả vào đúng 1 nhóm:
- READ_FIRST: nên đọc trước vì phù hợp trực tiếp nhu cầu tìm kiếm.
- READ_LATER: có liên quan nhưng chỉ nên đọc thêm nếu cần.
- SKIP: có thể bỏ qua vì chỉ giống ngữ nghĩa hoặc lệch nhu cầu.

Trả về JSON đúng dạng:
{"summary":"nhận xét ngắn bằng tiếng Việt","items":[{"chunkId":"id","group":"READ_FIRST|READ_LATER|SKIP","reason":"lý do ngắn, dễ hiểu"}]}

Kết quả:
${JSON.stringify(compactResults, null, 2)}`,
      },
    ]);

    const curated = curatedResponseSchema.parse(parseJson(response));
    const allowedChunkIds = new Set(parsed.data.results.map((result) => result.chunkId));
    const seenChunkIds = new Set<string>();
    const items = curated.items.filter((item) => {
      if (!allowedChunkIds.has(item.chunkId) || seenChunkIds.has(item.chunkId)) return false;
      seenChunkIds.add(item.chunkId);
      return true;
    });

    return NextResponse.json({
      summary: curated.summary,
      items,
    });
  } catch (error) {
    const message = safeAiErrorMessage(error, "AI chưa lọc được kết quả.");
    return NextResponse.json({ message }, { status: 503 });
  }
}
