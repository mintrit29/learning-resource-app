import { Difficulty, DocumentStatus, DocumentTagSource, JobStatus } from "@/generated/prisma/enums";
import { aiDocumentAnalysisSchema } from "@/lib/ai/analysis-schema";
import { completeChat } from "@/lib/ai/chat-provider";
import { AiProviderError, safeAiErrorMessage } from "@/lib/ai/provider-errors";
import { db } from "@/lib/db";
import { ensureCurriculumTopics } from "@/lib/taxonomy/curriculum-topics";
import { selectAllowedTopic } from "@/lib/taxonomy/constrained-classification";
import { replaceDocumentTopic } from "@/lib/taxonomy/topic-assignment";

const MIN_AUTO_CLASSIFICATION_CONFIDENCE = 0.75;

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
      select: { id: true, originalFileName: true, textContent: true },
    });
    if (!document.textContent) throw new AiProviderError("Tài liệu chưa có nội dung để phân tích.");

    const provider = await db.aiProvider.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    if (!provider) throw new AiProviderError("Chưa có kết nối AI đang hoạt động.");

    await Promise.all([
      db.analysisJob.update({
        where: { id: jobId },
        data: { status: JobStatus.PROCESSING, progress: 10, startedAt: new Date(), errorMessage: null },
      }),
      db.document.update({ where: { id: document.id }, data: { status: DocumentStatus.ANALYZING } }),
    ]);

    await ensureCurriculumTopics();
    const topics = await db.tag.findMany({
      where: { isClassificationEnabled: true },
      select: { id: true, name: true, description: true },
      orderBy: { name: "asc" },
    });
    const topicContext = topics.length
      ? topics.map((topic) => `- ID: ${topic.id} | Môn: ${topic.name}${topic.description ? ` | ${topic.description}` : ""}`).join("\n")
      : "Không có môn học nào.";
    const content = document.textContent.slice(0, 100_000);
    const response = await completeChat(provider, [
      {
        role: "system",
        content:
          "Bạn là bộ phân loại học liệu. Bạn chỉ được chọn ID môn học trong danh sách người dùng cung cấp hoặc trả về null. Tuyệt đối không tạo tên hay ID môn mới. Chỉ trả về một JSON hợp lệ, không markdown.",
      },
      {
        role: "user",
        content: `Phân tích học liệu sau và trả về JSON theo đúng cấu trúc.
Chỉ chọn một ID từ danh sách môn học bên dưới khi nội dung thật sự phù hợp. Nếu tài liệu ngoài chương trình, quá chung chung hoặc không đủ bằng chứng, đặt topicId là null. Không được tự tạo môn mới.

Danh sách môn học được phép chọn:
${topicContext}

{"topicId":"ID trong danh sách hoặc null","confidence":0.0,"difficulty":"BEGINNER|INTERMEDIATE|ADVANCED","language":"ngôn ngữ chính, ví dụ English hoặc Vietnamese","summary":"tóm tắt tiếng Việt 5-8 câu","reason":"lý do chọn môn hoặc lý do để chưa phân loại, kèm lý do chọn độ khó"}

Tên file: ${document.originalFileName}
Nội dung:
${content}`,
      },
    ]);
    const result = aiDocumentAnalysisSchema.parse(parseJson(response));
    const requestedTopic = result.topicId
      ? topics.find((topic) => topic.id === result.topicId) ?? null
      : null;
    const selectedTopic = selectAllowedTopic(
      topics,
      result.topicId,
      result.confidence,
      MIN_AUTO_CLASSIFICATION_CONFIDENCE,
    );
    await replaceDocumentTopic({
      documentId: document.id,
      topicId: selectedTopic?.id ?? null,
      source: DocumentTagSource.AI,
      confidence: result.confidence,
    });
    const classificationReason = selectedTopic
      ? `${result.reason} Độ tin cậy phân loại: ${Math.round(result.confidence * 100)}%.`
      : `${requestedTopic ? "Độ tin cậy chưa đạt 75%." : "Không có môn học phù hợp trong danh sách."} ${result.reason}`;

    await db.$transaction([
      db.document.update({
        where: { id: document.id },
        data: {
          primaryTopic: selectedTopic?.name ?? null,
          difficulty: result.difficulty as Difficulty,
          language: result.language,
          summary: result.summary,
          analysisReason: classificationReason,
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
    const message = safeAiErrorMessage(error, "AI không thể phân tích tài liệu.");
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
