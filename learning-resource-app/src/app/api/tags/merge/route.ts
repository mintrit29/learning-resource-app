import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { DocumentTagSource } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

const mergeSchema = z.object({
  sourceTagId: z.string().trim().min(1),
  targetTagId: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });
  }

  const parsed = mergeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Dữ liệu gộp môn học không hợp lệ" }, { status: 400 });
  }

  const { sourceTagId, targetTagId } = parsed.data;
  if (sourceTagId === targetTagId) {
    return NextResponse.json({ message: "Môn muốn bỏ và môn giữ lại phải khác nhau" }, { status: 400 });
  }

  const [sourceTag, targetTag] = await Promise.all([
    db.tag.findFirst({
      where: { id: sourceTagId, createdByUserId: session.user.id },
      include: { aliases: true, documents: true },
    }),
    db.tag.findFirst({
      where: { id: targetTagId, createdByUserId: session.user.id },
      select: { id: true, name: true },
    }),
  ]);

  if (!sourceTag || !targetTag) {
    return NextResponse.json({ message: "Không tìm thấy môn học muốn gộp" }, { status: 404 });
  }

  await db.$transaction(async (tx) => {
    await tx.tag.update({
      where: { id: targetTagId },
      data: { isClassificationEnabled: true },
    });
    await tx.tagAlias.upsert({
      where: {
        tagId_normalizedAlias: {
          tagId: targetTagId,
          normalizedAlias: sourceTag.normalizedName,
        },
      },
      create: {
        tagId: targetTagId,
        alias: sourceTag.name,
        normalizedAlias: sourceTag.normalizedName,
      },
      update: { alias: sourceTag.name },
    });

    for (const alias of sourceTag.aliases) {
      await tx.tagAlias.upsert({
        where: {
          tagId_normalizedAlias: {
            tagId: targetTagId,
            normalizedAlias: alias.normalizedAlias,
          },
        },
        create: {
          tagId: targetTagId,
          alias: alias.alias,
          normalizedAlias: alias.normalizedAlias,
        },
        update: { alias: alias.alias },
      });
    }

    for (const sourceDocument of sourceTag.documents) {
      const existing = await tx.documentTag.findUnique({
        where: {
          documentId_tagId: {
            documentId: sourceDocument.documentId,
            tagId: targetTagId,
          },
        },
      });
      await tx.documentTag.upsert({
        where: {
          documentId_tagId: {
            documentId: sourceDocument.documentId,
            tagId: targetTagId,
          },
        },
        create: {
          documentId: sourceDocument.documentId,
          tagId: targetTagId,
          confidence: sourceDocument.confidence,
          source: DocumentTagSource.MERGED,
        },
        update: {
          confidence: Math.max(existing?.confidence ?? 0, sourceDocument.confidence),
          source: DocumentTagSource.MERGED,
        },
      });
    }

    await tx.document.updateMany({
      where: {
        userId: session.user.id,
        OR: [
          { primaryTopic: sourceTag.name },
          { id: { in: sourceTag.documents.map((item) => item.documentId) } },
        ],
      },
      data: { primaryTopic: targetTag.name },
    });

    await tx.tag.delete({ where: { id: sourceTagId } });
  });

  return NextResponse.json({ message: "Đã gộp môn học" });
}
