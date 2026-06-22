import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { listProviderModels } from "@/lib/ai/chat-provider";
import { encryptApiKey, normalizeBaseUrl, providerTypes } from "@/lib/ai/provider-config";

type DiscoveryBody = {
  providerId?: string;
  type?: string;
  baseUrl?: string;
  apiKey?: string;
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });
  const body = await request.json().catch(() => null) as DiscoveryBody | null;

  try {
    let config;
    if (body?.providerId) {
      const saved = await db.aiProvider.findFirst({ where: { id: body.providerId, userId: session.user.id } });
      if (!saved) return NextResponse.json({ message: "Không tìm thấy provider" }, { status: 404 });
      config = {
        ...saved,
        baseUrl: body.baseUrl ? normalizeBaseUrl(new URL(body.baseUrl).toString()) : saved.baseUrl,
        apiKeyEncrypted: body.apiKey ? encryptApiKey(body.apiKey) : saved.apiKeyEncrypted,
      };
    } else {
      if (!body?.type || !providerTypes.includes(body.type as (typeof providerTypes)[number])) {
        return NextResponse.json({ message: "Loại provider không hợp lệ" }, { status: 400 });
      }
      const parsedUrl = new URL(body.baseUrl ?? "");
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return NextResponse.json({ message: "Base URL phải dùng HTTP hoặc HTTPS" }, { status: 400 });
      }
      config = {
        type: body.type,
        baseUrl: normalizeBaseUrl(parsedUrl.toString()),
        apiKeyEncrypted: encryptApiKey(body.apiKey ?? ""),
        defaultChatModel: null,
      };
    }

    const models = await listProviderModels(config);
    return NextResponse.json({ models: [...new Set(models)].sort() });
  } catch (error) {
    const message = error instanceof Error && error.name !== "AbortError" ? error.message : "Kết nối quá thời gian";
    return NextResponse.json({ message }, { status: 502 });
  }
}
