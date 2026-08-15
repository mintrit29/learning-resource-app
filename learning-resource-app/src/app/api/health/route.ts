import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSqliteVectorStore } from "@/lib/vector/sqlite-vector-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const expectedToken = process.env.SCHOLARFLOW_HEALTH_TOKEN;
  const receivedToken = request.headers.get("x-scholarflow-health-token");

  if (!expectedToken || receivedToken !== expectedToken) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }

  await db.document.count();
  const indexedChunks = getSqliteVectorStore().count();

  return NextResponse.json({
    status: "ok",
    application: "scholarflow-desktop",
    protocolVersion: 1,
    storage: "sqlite",
    indexedChunks,
  });
}
