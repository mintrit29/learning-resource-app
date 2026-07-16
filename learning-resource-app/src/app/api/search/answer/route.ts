import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { completeChat } from "@/lib/ai/chat-provider";
import { db } from "@/lib/db";
import { normalizeSearchText } from "@/lib/search/ranking";

const requestSchema = z.object({
  query: z.string().trim().min(2).max(500),
  chunkIds: z.array(z.string().trim().min(1)).min(1).max(8),
});

const aiResponseSchema = z.object({
  answer: z.string().trim().min(1).max(4000),
  citations: z.array(z.object({
    chunkId: z.string().trim().min(1),
    quote: z.string().trim().max(400).optional().default(""),
  })).max(8),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  notEnoughEvidence: z.boolean(),
});

function parseJson(value: string) {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned) as unknown;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dữ liệu tạo câu trả lời không hợp lệ" }, { status: 400 });
  }

  const provider = await db.aiProvider.findFirst({
    where: { userId: session.user.id, isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!provider) {
    return NextResponse.json(
      { message: "Chưa có AI provider đang hoạt động. Hãy bật provider trong Cài đặt trước." },
      { status: 400 },
    );
  }

  const chunks = await db.documentChunk.findMany({
    where: {
      id: { in: parsed.data.chunkIds },
      document: { userId: session.user.id },
    },
    select: {
      id: true,
      content: true,
      pageNumber: true,
      sourceLabel: true,
      document: { select: { id: true, title: true, fileType: true } },
    },
  });
  const chunksById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const orderedChunks = parsed.data.chunkIds
    .map((id) => chunksById.get(id))
    .filter((chunk): chunk is NonNullable<typeof chunk> => Boolean(chunk))
    .slice(0, 8);
  if (!orderedChunks.length) {
    return NextResponse.json({ message: "Không tìm thấy bằng chứng hợp lệ trong thư viện của bạn" }, { status: 404 });
  }

  try {
    const evidence = orderedChunks.map((chunk, index) => ({
      index: index + 1,
      chunkId: chunk.id,
      document: chunk.document.title,
      location: chunk.sourceLabel ?? (chunk.pageNumber ? `Trang ${chunk.pageNumber}` : "Không rõ vị trí"),
      content: chunk.content.slice(0, 1800),
    }));
    const rawResponse = await completeChat(provider, [
      {
        role: "system",
        content: "Bạn là trợ lý nghiên cứu. Chỉ được trả lời từ các đoạn bằng chứng được cung cấp. Chỉ trả về một JSON object hợp lệ, không markdown.",
      },
      {
        role: "user",
        content: `Câu hỏi: ${parsed.data.query}\n\nNếu bằng chứng không đủ, nói rõ điều đó và đặt notEnoughEvidence=true. Không dùng kiến thức bên ngoài. Mỗi ý khẳng định phải dựa trên ít nhất một chunkId có thật.\n\nTrả về đúng dạng:\n{"answer":"câu trả lời ngắn bằng tiếng Việt","citations":[{"chunkId":"id","quote":"trích đoạn ngắn làm bằng chứng"}],"confidence":"LOW|MEDIUM|HIGH","notEnoughEvidence":false}\n\nBằng chứng:\n${JSON.stringify(evidence, null, 2)}`,
      },
    ]);
    const aiResponse = aiResponseSchema.parse(parseJson(rawResponse));
    const allowedIds = new Set(orderedChunks.map((chunk) => chunk.id));
    const seenIds = new Set<string>();
    const citations = aiResponse.citations
      .filter((citation) => allowedIds.has(citation.chunkId) && !seenIds.has(citation.chunkId))
      .map((citation) => {
        seenIds.add(citation.chunkId);
        const chunk = chunksById.get(citation.chunkId)!;
        const normalizedQuote = normalizeSearchText(citation.quote);
        const quote = normalizedQuote && normalizeSearchText(chunk.content).includes(normalizedQuote)
          ? citation.quote
          : "";
        return {
          ...citation,
          quote,
          documentId: chunk.document.id,
          title: chunk.document.title,
          fileType: chunk.document.fileType,
          pageNumber: chunk.pageNumber,
          sourceLabel: chunk.sourceLabel,
        };
      });
    const notEnoughEvidence = aiResponse.notEnoughEvidence || citations.length === 0;

    return NextResponse.json({
      answer: notEnoughEvidence && citations.length === 0
        ? "Các đoạn tìm được chưa đủ bằng chứng để trả lời chắc chắn câu hỏi này."
        : aiResponse.answer,
      citations,
      confidence: notEnoughEvidence ? "LOW" : aiResponse.confidence,
      notEnoughEvidence,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI chưa tạo được câu trả lời có dẫn chứng";
    return NextResponse.json({ message }, { status: 503 });
  }
}
