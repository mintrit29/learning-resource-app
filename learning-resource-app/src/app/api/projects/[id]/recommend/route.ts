import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateProjectRecommendations } from "@/lib/projects/recommend-project";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });
  try {
    const count = await generateProjectRecommendations((await context.params).id, session.user.id);
    return NextResponse.json({ count });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Không thể tạo gợi ý" }, { status: 503 });
  }
}
