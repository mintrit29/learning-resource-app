import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

// Same installed PDF.js version as the renderer; no CDN or background download.
export async function GET() {
  const worker = await readFile(path.join(process.cwd(), "node_modules/pdfjs-dist/build/pdf.worker.min.mjs"));
  return new Response(worker, { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-cache" } });
}
