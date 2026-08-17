import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { after, NextResponse } from "next/server";
import { DocumentStatus, FileType, JobType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { enqueueDocumentPipeline } from "@/lib/documents/document-processing-queue";
import type { SupportedExtension } from "@/lib/documents/extract-text";
import {
  MAX_UPLOAD_FILE_SIZE_BYTES,
  MAX_UPLOAD_FILE_SIZE_MB,
  SUPPORTED_UPLOAD_LABEL,
} from "@/lib/documents/upload-policy";
import { createNamedUploadStorageLocation } from "@/lib/storage/local-storage";
import { DOCLING_MISSING_MESSAGE, isDoclingReady } from "@/lib/desktop/component-availability";

export const runtime = "nodejs";

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

function hasExpectedSignature(buffer: Buffer, extension: SupportedExtension) {
  if (extension === "pdf") return buffer.subarray(0, 5).toString("utf8") === "%PDF-";
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

export async function POST(request: Request) {
  if (!await isDoclingReady()) {
    return NextResponse.json({ message: DOCLING_MISSING_MESSAGE, setupUrl: "/settings/components" }, { status: 503 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Chưa chọn tài liệu" }, { status: 400 });
  }

  const extension = getExtension(file.name);
  if (!extension) {
    return NextResponse.json(
      { message: `Chỉ hỗ trợ ${SUPPORTED_UPLOAD_LABEL}` },
      { status: 415 },
    );
  }

  if (file.size === 0 || file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { message: `File phải có dung lượng từ 1 byte đến ${MAX_UPLOAD_FILE_SIZE_MB} MB` },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!hasExpectedSignature(buffer, extension)) {
    return NextResponse.json(
      { message: "Nội dung file không khớp với định dạng đã chọn" },
      { status: 415 },
    );
  }

  const storageLocation = createNamedUploadStorageLocation(randomUUID(), file.name);
  await mkdir(storageLocation.directory, { recursive: true });
  await writeFile(storageLocation.absolutePath, buffer, { flag: "wx" });

  const title = path.basename(file.name, path.extname(file.name)).trim() || file.name;
  const document = await db.document.create({
    data: {
      title,
      originalFileName: file.name,
      fileType: FILE_TYPES[extension],
      filePath: storageLocation.storedPath,
      fileSize: file.size,
      status: DocumentStatus.UPLOADED,
      jobs: {
        create: [
          { type: JobType.EXTRACT_TEXT },
          { type: JobType.CHUNK_DOCUMENT },
          { type: JobType.EMBED_DOCUMENT },
          { type: JobType.ANALYZE_DOCUMENT },
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
  const analysisJobId = document.jobs.find((job) => job.type === JobType.ANALYZE_DOCUMENT)?.id;
  if (!extractionJobId || !chunkJobId || !embeddingJobId || !analysisJobId) {
    return NextResponse.json({ message: "Không thể tạo processing jobs" }, { status: 500 });
  }

  const processing = enqueueDocumentPipeline({
    documentId: document.id,
    extractionJobId,
    chunkJobId,
    embeddingJobId,
    analysisJobId,
  });
  after(() => processing);

  return NextResponse.json(
    { documentId: document.id, status: DocumentStatus.UPLOADED },
    { status: 202 },
  );
}
