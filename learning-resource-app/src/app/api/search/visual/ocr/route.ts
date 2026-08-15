import { NextResponse } from "next/server";
import { z } from "zod";
import { recognizeSearchRegion } from "@/lib/documents/ocr-region";
import { decodeSearchRegionDataUrl } from "@/lib/search/visual-search-input";

export const runtime = "nodejs";

const MAX_ENCODED_IMAGE_BYTES = 12 * 1024 * 1024;
const requestSchema = z.object({ imageDataUrl: z.string().max(MAX_ENCODED_IMAGE_BYTES) });

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Ảnh vùng chọn không hợp lệ." }, { status: 400 });
  }

  try {
    const text = await recognizeSearchRegion(decodeSearchRegionDataUrl(parsed.data.imageDataUrl));
    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể nhận dạng vùng đã chọn.";
    return NextResponse.json({ message }, { status: 422 });
  }
}
