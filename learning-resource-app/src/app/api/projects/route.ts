import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { Difficulty } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { generateProjectRecommendations } from "@/lib/projects/recommend-project";

const projectSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(3000),
  keywords: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  targetDifficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).nullable().default(null),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });
  const parsed = projectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }, { status: 400 });
  try {
    const project = await db.project.create({ data: { userId: session.user.id, title: parsed.data.title, description: parsed.data.description, keywords: [...new Set(parsed.data.keywords)], targetDifficulty: parsed.data.targetDifficulty as Difficulty | null } });
    try {
      await generateProjectRecommendations(project.id, session.user.id);
    } catch (error) {
      return NextResponse.json({ project, warning: error instanceof Error ? error.message : "Chưa thể tạo gợi ý" }, { status: 201 });
    }
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Không thể tạo project" }, { status: 503 });
  }
}
