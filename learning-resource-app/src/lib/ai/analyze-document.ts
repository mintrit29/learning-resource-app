import { z } from "zod";
import { Difficulty, DocumentStatus, JobStatus } from "@/generated/prisma/enums";
import { completeChat } from "@/lib/ai/chat-provider";
import { db } from "@/lib/db";

const topics = [
  "Artificial Intelligence",
  "Machine Learning",
  "Database",
  "Cybersecurity",
  "Web Development",
  "Software Engineering",
  "Computer Networks",
  "Mathematics",
  "Data Science",
  "Language Learning",
  "Other",
] as const;

const resultSchema = z.object({
  topic: z.enum(topics),
  difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  summary: z.string().trim().min(20).max(5000),
  subtopics: z.array(z.string().trim().min(2).max(100)).min(2).max(12),
  keywords: z.array(z.string().trim().min(1).max(80)).min(3).max(30),
  reason: z.string().trim().min(10).max(2000),
});

function parseJson(value: string) {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned) as unknown;
}

export async function analyzeDocument(documentId: string, jobId: string) {
  try {
    const document = await db.document.findUniqueOrThrow({
      where: { id: documentId },
      select: { id: true, userId: true, originalFileName: true, textContent: true },
    });
    if (!document.textContent) throw new Error("Tài liệu chưa có nội dung để phân tích");

    const provider = await db.aiProvider.findFirst({
      where: { userId: document.userId, isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    if (!provider) throw new Error("Chưa có AI provider đang hoạt động");

    await Promise.all([
      db.analysisJob.update({
        where: { id: jobId },
        data: { status: JobStatus.PROCESSING, progress: 10, startedAt: new Date(), errorMessage: null },
      }),
      db.document.update({ where: { id: document.id }, data: { status: DocumentStatus.ANALYZING } }),
    ]);

    const content = document.textContent.slice(0, 100_000);
    const response = await completeChat(provider, [
      {
        role: "system",
        content: "You analyze learning resources. Return one valid JSON object only, with no markdown.",
      },
      {
        role: "user",
        content: `Phân tích học liệu sau và trả về JSON theo đúng cấu trúc. Topic phải là một trong: ${topics.join(", ")}.
{"topic":"chủ đề chính","difficulty":"BEGINNER|INTERMEDIATE|ADVANCED","summary":"tóm tắt tiếng Việt 5-8 câu","subtopics":["2-12 chủ đề con cụ thể"],"keywords":["3-30 từ khóa"],"reason":"lý do chọn chủ đề và độ khó"}

Tên file: ${document.originalFileName}
Nội dung:
${content}`,
      },
    ]);
    const result = resultSchema.parse(parseJson(response));

    await db.$transaction([
      db.document.update({
        where: { id: document.id },
        data: {
          primaryTopic: result.topic,
          difficulty: result.difficulty as Difficulty,
          summary: result.summary,
          subtopics: [...new Set(result.subtopics)],
          keywords: [...new Set(result.keywords)],
          analysisReason: result.reason,
          status: DocumentStatus.READY,
        },
      }),
      db.analysisJob.update({
        where: { id: jobId },
        data: { status: JobStatus.COMPLETED, progress: 100, finishedAt: new Date(), errorMessage: null },
      }),
    ]);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Phân tích AI thất bại";
    await Promise.all([
      db.analysisJob.update({
        where: { id: jobId },
        data: { status: JobStatus.FAILED, errorMessage: message.slice(0, 500), finishedAt: new Date() },
      }),
      db.document.update({
        where: { id: documentId },
        data: { status: DocumentStatus.READY, analysisReason: `AI: ${message}`.slice(0, 500) },
      }),
    ]);
    return false;
  }
}
