import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encryptApiKey, normalizeBaseUrl, providerSchema, publicProvider } from "@/lib/ai/provider-config";

export async function GET() {
  const providers = await db.aiProvider.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ providers: providers.map(publicProvider) });
}

export async function POST(request: Request) {
  const parsed = providerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }, { status: 400 });

  const provider = await db.$transaction(async (tx) => {
    if (parsed.data.isActive) await tx.aiProvider.updateMany({ data: { isActive: false } });
    return tx.aiProvider.create({ data: {
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
