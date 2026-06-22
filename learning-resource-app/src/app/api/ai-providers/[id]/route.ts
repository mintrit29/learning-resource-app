import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { encryptApiKey, normalizeBaseUrl, providerUpdateSchema } from "@/lib/ai/provider-config";

async function ownedProvider(id: string, userId: string) {
  return db.aiProvider.findFirst({ where: { id, userId } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });
  const { id } = await params;
  if (!await ownedProvider(id, session.user.id)) return NextResponse.json({ message: "Không tìm thấy provider" }, { status: 404 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (body?.isActive === true) {
    await db.$transaction([
      db.aiProvider.updateMany({ where: { userId: session.user.id }, data: { isActive: false } }),
      db.aiProvider.update({ where: { id }, data: { isActive: true } }),
    ]);
    return NextResponse.json({ message: "Đã đặt provider mặc định" });
  }

  const parsed = providerUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }, { status: 400 });
  const updated = await db.aiProvider.update({ where: { id }, data: {
    displayName: parsed.data.displayName,
    baseUrl: normalizeBaseUrl(parsed.data.baseUrl),
    defaultChatModel: parsed.data.defaultChatModel,
    ...(parsed.data.apiKey ? { apiKeyEncrypted: encryptApiKey(parsed.data.apiKey) } : {}),
    authStatus: "UNTESTED",
  }});
  return NextResponse.json({ provider: { id: updated.id, displayName: updated.displayName, baseUrl: updated.baseUrl, defaultChatModel: updated.defaultChatModel, authStatus: updated.authStatus, hasApiKey: Boolean(updated.apiKeyEncrypted) }, message: "Đã cập nhật provider" });
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
