import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const expected = process.env.SCHOLARFLOW_HEALTH_TOKEN;
  if (!expected || request.headers.get("x-scholarflow-health-token") !== expected) {
    return NextResponse.json({ message: "Không được phép" }, { status: 403 });
  }
  const { id } = await params;
  const document = await db.document.findFirst({
    where: { id },
    select: { filePath: true },
  });
  if (!document) {
    return NextResponse.json({ message: "Không tìm thấy tài liệu" }, { status: 404 });
  }
  return NextResponse.json({ filePath: document.filePath });
}
