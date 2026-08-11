import { after, NextResponse } from "next/server";
import { recoverInterruptedDocumentProcessing } from "@/lib/documents/recover-processing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const expectedToken = process.env.SCHOLARFLOW_HEALTH_TOKEN;
  const receivedToken = request.headers.get("x-scholarflow-health-token");
  if (!expectedToken || receivedToken !== expectedToken) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }

  const recovery = await recoverInterruptedDocumentProcessing();
  after(() => recovery.completion);
  return NextResponse.json({ status: "ok", scheduled: recovery.scheduled });
}
