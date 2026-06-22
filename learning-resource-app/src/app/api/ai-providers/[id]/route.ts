import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

async function ownedProvider(id: string, userId: string) {
  return db.aiProvider.findFirst({ where: { id, userId } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });
  const { id } = await params;
  if (!await ownedProvider(id, session.user.id)) return NextResponse.json({ message: "Không tìm thấy provider" }, { status: 404 });
  const body = await request.json().catch(() => null) as { isActive?: boolean } | null;
  if (body?.isActive !== true) return NextResponse.json({ message: "Thao tác không hợp lệ" }, { status: 400 });
  await db.$transaction([
    db.aiProvider.updateMany({ where: { userId: session.user.id }, data: { isActive: false } }),
    db.aiProvider.update({ where: { id }, data: { isActive: true } }),
  ]);
  return NextResponse.json({ message: "Đã đặt provider mặc định" });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });
  const { id } = await params;
  const provider = await ownedProvider(id, session.user.id);
  if (!provider) return NextResponse.json({ message: "Không tìm thấy provider" }, { status: 404 });
  await db.aiProvider.delete({ where: { id } });
  return NextResponse.json({ message: "Đã xóa provider" });
}
