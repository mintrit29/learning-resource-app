import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { listProviderModels } from "@/lib/ai/chat-provider";
import { encryptApiKey, normalizeBaseUrl, providerTypes } from "@/lib/ai/provider-config";
import { safeAiErrorMessage } from "@/lib/ai/provider-errors";

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
      const requestedType = body.type ?? saved.type;
      if (!providerTypes.includes(requestedType as (typeof providerTypes)[number])) {
        return NextResponse.json({ message: "Loại provider không hợp lệ" }, { status: 400 });
      }
      if (requestedType !== "OLLAMA" && !body.apiKey && !saved.apiKeyEncrypted) {
        return NextResponse.json({ message: "Hãy nhập API key trước khi tải danh sách model" }, { status: 400 });
      }
      config = {
        ...saved,
        type: requestedType,
        baseUrl: body.baseUrl ? normalizeBaseUrl(new URL(body.baseUrl).toString()) : saved.baseUrl,
        apiKeyEncrypted: requestedType === "OLLAMA"
          ? null
          : body.apiKey
            ? encryptApiKey(body.apiKey)
            : saved.apiKeyEncrypted,
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
    const message = safeAiErrorMessage(error, "Không thể tải danh sách model.");
    return NextResponse.json({ message }, { status: 502 });
  }
}
