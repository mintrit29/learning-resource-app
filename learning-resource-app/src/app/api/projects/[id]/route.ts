import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });

  const project = await db.project.findFirst({
    where: { id: (await params).id, userId: session.user.id },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ message: "Không tìm thấy project" }, { status: 404 });

  await db.project.delete({ where: { id: project.id } });
  return NextResponse.json({ message: "Đã xóa project" });
}
