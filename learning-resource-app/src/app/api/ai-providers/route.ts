import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { encryptApiKey, normalizeBaseUrl, providerSchema, publicProvider } from "@/lib/ai/provider-config";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });
  const providers = await db.aiProvider.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ providers: providers.map(publicProvider) });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });
  const parsed = providerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }, { status: 400 });

  const provider = await db.$transaction(async (tx) => {
    if (parsed.data.isActive) await tx.aiProvider.updateMany({ where: { userId: session.user.id }, data: { isActive: false } });
    return tx.aiProvider.create({ data: {
      userId: session.user.id,
      type: parsed.data.type,
      displayName: parsed.data.displayName,
      baseUrl: normalizeBaseUrl(parsed.data.baseUrl),
      apiKeyEncrypted: encryptApiKey(parsed.data.apiKey),
      defaultChatModel: parsed.data.defaultChatModel,
      isActive: parsed.data.isActive,
      authStatus: "UNTESTED",
    }});
  });
  return NextResponse.json({ provider: publicProvider(provider) }, { status: 201 });
}
