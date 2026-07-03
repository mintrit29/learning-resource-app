import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { embedTexts, toPgVector } from "@/lib/embedding/client";

const searchSchema = z.object({
  query: z.string().trim().min(2).max(500),
  limit: z.number().int().min(1).max(20).default(10),
  topic: z.string().trim().max(120).optional(),
  difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
  fileType: z.enum(["PDF", "PPTX", "DOCX", "EPUB"]).optional(),
});

type SearchRow = {
  chunkId: string;
  documentId: string;
  title: string;
  fileType: string;
  primaryTopic: string | null;
  difficulty: string | null;
  content: string;
  pageNumber: number | null;
  sourceLabel: string | null;
  score: number;
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = searchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Truy vấn không hợp lệ" }, { status: 400 });
  }

  try {
    const embedded = await embedTexts([parsed.data.query]);
    const vector = toPgVector(embedded.embeddings[0]);
    const candidateLimit = parsed.data.limit * 5;
    const rows = await db.$queryRawUnsafe<SearchRow[]>(
    `SELECT
      c."id" AS "chunkId",
      d."id" AS "documentId",
      d."title",
      d."fileType"::text AS "fileType",
      d."primaryTopic",
      d."difficulty"::text AS "difficulty",
      c."content",
      c."pageNumber",
      c."sourceLabel",
      (1 - (c."embedding" <=> $1::vector))::float8 AS "score"
    FROM "DocumentChunk" c
    JOIN "Document" d ON d."id" = c."documentId"
    WHERE d."userId" = $2
      AND c."embedding" IS NOT NULL
      AND ($3::text IS NULL OR d."primaryTopic" = $3::text)
      AND ($4::text IS NULL OR d."difficulty"::text = $4::text)
      AND ($5::text IS NULL OR d."fileType"::text = $5::text)
    ORDER BY c."embedding" <=> $1::vector
    LIMIT $6`,
      vector,
      session.user.id,
      parsed.data.topic || null,
      parsed.data.difficulty || null,
      parsed.data.fileType || null,
      candidateLimit,
    );

    const seenDocuments = new Set<string>();
    const results = rows.filter((row) => {
      if (seenDocuments.has(row.documentId)) return false;
      seenDocuments.add(row.documentId);
      return true;
    }).slice(0, parsed.data.limit);

    return NextResponse.json({ query: parsed.data.query, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Semantic search thất bại";
    return NextResponse.json({ message }, { status: 503 });
  }
}
