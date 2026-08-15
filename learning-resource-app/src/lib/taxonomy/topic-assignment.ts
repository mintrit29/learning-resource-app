import { DocumentTagSource } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

type AssignmentInput = {
  documentId: string;
  topicId: string | null;
  source: DocumentTagSource;
  confidence?: number;
};

export async function replaceDocumentTopic(input: AssignmentInput) {
  const document = await db.document.findFirst({
    where: { id: input.documentId },
    select: { id: true },
  });
  if (!document) {
    throw new Error("Không tìm thấy tài liệu trong thư viện của bạn.");
  }

  const topic = input.topicId
    ? await db.tag.findFirst({
        where: {
          id: input.topicId,
          isClassificationEnabled: true,
        },
        select: { id: true, name: true },
      })
    : null;

  if (input.topicId && !topic) {
    throw new Error("Môn học đã chọn không có trong danh sách được phép phân loại.");
  }

  await db.$transaction(async (transaction) => {
    await transaction.documentTag.deleteMany({ where: { documentId: input.documentId } });
    if (topic) {
      await transaction.documentTag.create({
        data: {
          documentId: input.documentId,
          tagId: topic.id,
          source: input.source,
          confidence: input.confidence ?? 1,
        },
      });
    }
    await transaction.document.update({
      where: { id: input.documentId },
      data: { primaryTopic: topic?.name ?? null },
    });
  });

  return topic;
}
