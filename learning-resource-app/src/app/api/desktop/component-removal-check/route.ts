import { NextResponse } from "next/server";
import { JobStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const expected = process.env.SCHOLARFLOW_HEALTH_TOKEN;
  if (!expected || request.headers.get("x-scholarflow-health-token") !== expected) {
    return NextResponse.json({ message: "Không được phép" }, { status: 403 });
  }
  const active = await db.analysisJob.count({
    where: { status: { in: [JobStatus.PENDING, JobStatus.PROCESSING] } },
  });
  return NextResponse.json({ active: active > 0 });
}
