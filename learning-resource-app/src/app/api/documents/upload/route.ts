import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { after, NextResponse } from "next/server";
import { auth } from "@/auth";
import { DocumentStatus, FileType, JobType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import type { SupportedExtension } from "@/lib/documents/extract-text";
import { processDocumentPipeline } from "@/lib/documents/process-document";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const FILE_TYPES: Record<SupportedExtension, FileType> = {
  pdf: FileType.PDF,
  pptx: FileType.PPTX,
  docx: FileType.DOCX,
  epub: FileType.EPUB,
};

function getExtension(fileName: string): SupportedExtension | null {
  const extension = path.extname(fileName).slice(1).toLowerCase();
  return extension in FILE_TYPES ? (extension as SupportedExtension) : null;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Chưa chọn tài liệu" }, { status: 400 });
  }

  const extension = getExtension(file.name);
  if (!extension) {
    return NextResponse.json(
      { message: "Chỉ hỗ trợ PDF, PPTX, DOCX và EPUB" },
      { status: 415 },
    );
  }

  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { message: "File phải có dung lượng từ 1 byte đến 25 MB" },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storageDirectory = path.join(
    process.cwd(),
    "storage",
    "uploads",
    session.user.id,
  );
  await mkdir(storageDirectory, { recursive: true });

  const storedName = `${randomUUID()}.${extension}`;
  const absolutePath = path.join(storageDirectory, storedName);
  const relativePath = path.relative(process.cwd(), absolutePath).replaceAll("\\", "/");
  await writeFile(absolutePath, buffer, { flag: "wx" });

  const title = path.basename(file.name, path.extname(file.name)).trim() || file.name;
  const document = await db.document.create({
    data: {
      userId: session.user.id,
      title,
      originalFileName: file.name,
      fileType: FILE_TYPES[extension],
      filePath: relativePath,
      fileSize: file.size,
      status: DocumentStatus.UPLOADED,
      jobs: {
        create: [
          { type: JobType.EXTRACT_TEXT },
          { type: JobType.CHUNK_DOCUMENT },
          { type: JobType.EMBED_DOCUMENT },
        ],
      },
    },
    select: {
      id: true,
      jobs: { select: { id: true, type: true } },
    },
  });

  const extractionJobId = document.jobs.find((job) => job.type === JobType.EXTRACT_TEXT)?.id;
  const chunkJobId = document.jobs.find((job) => job.type === JobType.CHUNK_DOCUMENT)?.id;
  const embeddingJobId = document.jobs.find((job) => job.type === JobType.EMBED_DOCUMENT)?.id;
  if (!extractionJobId || !chunkJobId || !embeddingJobId) {
    return NextResponse.json({ message: "Không thể tạo processing jobs" }, { status: 500 });
  }

  after(() =>
    processDocumentPipeline({
      documentId: document.id,
      extractionJobId,
      chunkJobId,
      embeddingJobId,
    }),
  );

  return NextResponse.json(
    { documentId: document.id, status: DocumentStatus.UPLOADED },
    { status: 202 },
  );
}
