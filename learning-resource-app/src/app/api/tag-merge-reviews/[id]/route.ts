import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { DocumentTagSource, TagMergeReviewStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

const schema = z.object({ action: z.enum(["APPROVE", "REJECT"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Thao tác không hợp lệ" }, { status: 400 });
  const { id } = await params;
  const review = await db.tagMergeReview.findFirst({ where: { id, userId: session.user.id, status: TagMergeReviewStatus.PENDING } });
  if (!review) return NextResponse.json({ message: "Không tìm thấy đề xuất đang chờ" }, { status: 404 });

  if (parsed.data.action === "APPROVE") {
    await db.$transaction(async (tx) => {
      await tx.tagAlias.upsert({
        where: { tagId_normalizedAlias: { tagId: review.suggestedTagId, normalizedAlias: review.candidateNormalizedName } },
        create: { tagId: review.suggestedTagId, alias: review.candidateTagName, normalizedAlias: review.candidateNormalizedName },
        update: { alias: review.candidateTagName },
      });
      if (review.documentId) await tx.documentTag.upsert({
        where: { documentId_tagId: { documentId: review.documentId, tagId: review.suggestedTagId } },
        create: { documentId: review.documentId, tagId: review.suggestedTagId, confidence: review.similarity, source: DocumentTagSource.MERGED },
        update: { confidence: review.similarity, source: DocumentTagSource.MERGED },
      });
      await tx.tagMergeReview.update({ where: { id }, data: { status: TagMergeReviewStatus.APPROVED, resolvedAt: new Date() } });
    });
    return NextResponse.json({ message: "Đã gộp candidate vào canonical tag" });
  }

  await db.$transaction(async (tx) => {
    let tag = await tx.tag.findUnique({ where: { createdByUserId_normalizedName: { createdByUserId: session.user.id, normalizedName: review.candidateNormalizedName } } });
    if (!tag) {
      tag = await tx.tag.create({ data: { name: review.candidateTagName, normalizedName: review.candidateNormalizedName, createdByUserId: session.user.id } });
      await tx.$executeRawUnsafe('UPDATE "Tag" SET "embedding" = (SELECT "candidateEmbedding" FROM "TagMergeReview" WHERE "id" = $1) WHERE "id" = $2', id, tag.id);
    }
    if (review.documentId) await tx.documentTag.upsert({
      where: { documentId_tagId: { documentId: review.documentId, tagId: tag.id } },
      create: { documentId: review.documentId, tagId: tag.id, source: DocumentTagSource.AI },
      update: { source: DocumentTagSource.AI, confidence: 1 },
    });
    await tx.tagMergeReview.update({ where: { id }, data: { status: TagMergeReviewStatus.REJECTED, resolvedAt: new Date() } });
  });
  return NextResponse.json({ message: "Đã giữ candidate thành canonical tag riêng" });
}
