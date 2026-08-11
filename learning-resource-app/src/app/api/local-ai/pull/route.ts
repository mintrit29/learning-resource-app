import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAllowedLocalModel } from "@/lib/ai/local-model-catalog";
import { DEFAULT_OLLAMA_BASE_URL, isLoopbackUrl, localOllamaBaseUrl } from "@/lib/ai/local-ollama";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PullBody = {
  providerId?: string;
  model?: string;
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });

  const body = await request.json().catch(() => null) as PullBody | null;
  const model = body?.model?.trim() ?? "";
  if (!isAllowedLocalModel(model)) {
    return NextResponse.json({ message: "Model không nằm trong danh sách được ScholarFlow hỗ trợ." }, { status: 400 });
  }

  let savedProvider = null;
  if (body?.providerId) {
    savedProvider = await db.aiProvider.findFirst({
      where: { id: body.providerId, userId: session.user.id, type: "OLLAMA" },
    });
    if (!savedProvider) return NextResponse.json({ message: "Không tìm thấy kết nối Ollama." }, { status: 404 });
    if (!isLoopbackUrl(savedProvider.baseUrl)) {
      return NextResponse.json({ message: "Chỉ có thể tải model vào Ollama đang chạy trên thiết bị này." }, { status: 400 });
    }
  }

  const baseUrl = localOllamaBaseUrl(savedProvider?.baseUrl ?? DEFAULT_OLLAMA_BASE_URL);
  try {
    const response = await fetch(`${baseUrl}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, stream: true }),
      cache: "no-store",
      signal: request.signal,
    });
    if (!response.ok || !response.body) {
      const error = await response.json().catch(() => null) as { error?: string } | null;
      return NextResponse.json({
        message: error?.error || `Ollama không thể tải model (HTTP ${response.status}).`,
      }, { status: 502 });
    }
    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return NextResponse.json({
      message: "Không kết nối được Ollama. Hãy mở Ollama rồi thử lại.",
    }, { status: 502 });
  }
}
