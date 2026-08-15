import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hybridSearch } from "@/lib/search/hybrid-search";
import { inferSearchCriteria } from "@/lib/search/ranking";

const searchSchema = z.object({
  query: z.string().trim().min(2).max(500),
  chunksPerDocument: z.number().int().min(1).max(5).default(1),
  topic: z.string().trim().max(120).optional(),
  difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
  fileType: z.enum(["PDF", "PPTX", "DOCX", "EPUB"]).optional(),
  documentId: z.string().trim().optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
});

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = searchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Truy vấn không hợp lệ" }, { status: 400 });
  }

  try {
    const resultLimit = 30;
    const { candidates, diagnostics, retrievalMode } = await hybridSearch(parsed.data.query, parsed.data);

    const chunksByDocument = new Map<string, number>();
    const results = candidates.filter((row) => {
      const currentCount = chunksByDocument.get(row.documentId) ?? 0;
      if (currentCount >= parsed.data.chunksPerDocument) return false;
      chunksByDocument.set(row.documentId, currentCount + 1);
      return true;
    }).slice(0, resultLimit);
    const status = results.length
      ? "OK"
      : await db.document.count() === 0
        ? "EMPTY_LIBRARY"
        : "NO_RELEVANT_RESULTS";

    await db.searchLog.create({
      data: {
        query: parsed.data.query,
        filters: {
          topic: parsed.data.topic || null,
          difficulty: parsed.data.difficulty || null,
          fileType: parsed.data.fileType || null,
          documentId: parsed.data.documentId || null,
          dateFrom: parsed.data.dateFrom || null,
          dateTo: parsed.data.dateTo || null,
          limit: resultLimit,
          chunksPerDocument: parsed.data.chunksPerDocument,
          retrievalMode,
          bestScore: diagnostics.bestScore,
          acceptanceThreshold: diagnostics.acceptanceThreshold,
          rejectionReason: diagnostics.rejectionReason,
        },
        resultDocumentIds: [...new Set(results.map((result) => result.documentId))],
      },
    }).catch(() => null);

    return NextResponse.json({
      query: parsed.data.query,
      status,
      interpretedQuery: inferSearchCriteria(parsed.data.query),
      retrievalMode,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Semantic search thất bại";
    return NextResponse.json({ message }, { status: 503 });
  }
}
