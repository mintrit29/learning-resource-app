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
    return NextResponse.json({ message: "Dữ liệu gộp tag không hợp lệ" }, { status: 400 });
  }

  const { sourceTagId, targetTagId } = parsed.data;
  if (sourceTagId === targetTagId) {
    return NextResponse.json({ message: "Tag nguồn và tag đích phải khác nhau" }, { status: 400 });
  }

  const [sourceTag, targetTag] = await Promise.all([
    db.tag.findFirst({
      where: { id: sourceTagId, createdByUserId: session.user.id },
      include: { aliases: true },
    }),
    db.tag.findFirst({
      where: { id: targetTagId, createdByUserId: session.user.id },
      select: { id: true },
    }),
  ]);

  if (!sourceTag || !targetTag) {
    return NextResponse.json({ message: "Không tìm thấy tag nguồn hoặc tag đích" }, { status: 404 });
  }

  await db.$transaction(async (tx) => {
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

    await tx.$executeRaw`
      INSERT INTO "DocumentTag" ("documentId", "tagId", "confidence", "source", "createdAt")
      SELECT "documentId", ${targetTagId}, "confidence", ${DocumentTagSource.MERGED}::"DocumentTagSource", now()
      FROM "DocumentTag"
      WHERE "tagId" = ${sourceTagId}
      ON CONFLICT ("documentId", "tagId")
      DO UPDATE SET
        "confidence" = GREATEST("DocumentTag"."confidence", EXCLUDED."confidence"),
        "source" = ${DocumentTagSource.MERGED}::"DocumentTagSource"
    `;

    await tx.tag.delete({ where: { id: sourceTagId } });
  });

  return NextResponse.json({ message: "Đã gộp tag thủ công" });
}
