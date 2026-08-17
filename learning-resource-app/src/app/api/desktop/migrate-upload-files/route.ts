import { NextResponse } from "next/server";
import { migrateUploadFileNames } from "@/lib/storage/migrate-upload-file-names";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const expectedToken = process.env.SCHOLARFLOW_HEALTH_TOKEN;
  const receivedToken = request.headers.get("x-scholarflow-health-token");
  if (!expectedToken || receivedToken !== expectedToken) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }

  const migrated = await migrateUploadFileNames();
  return NextResponse.json({ status: "ok", migrated });
}
