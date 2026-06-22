import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { testProviderConnection } from "@/lib/ai/chat-provider";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });
  const { id } = await params;
  const provider = await db.aiProvider.findFirst({ where: { id, userId: session.user.id } });
  if (!provider) return NextResponse.json({ message: "Không tìm thấy provider" }, { status: 404 });
  try {
    const message = await testProviderConnection(provider);
    await db.aiProvider.update({ where: { id }, data: { authStatus: "CONNECTED" } });
    return NextResponse.json({ message });
  } catch (error) {
    await db.aiProvider.update({ where: { id }, data: { authStatus: "ERROR" } });
    const message = error instanceof Error && error.name !== "AbortError" ? error.message : "Kết nối quá thời gian";
    return NextResponse.json({ message }, { status: 502 });
  }
}
