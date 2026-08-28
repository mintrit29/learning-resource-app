import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readXmind } from "@/lib/documents/extract-xmind";
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
import {
  DOCLING_MISSING_MESSAGE,
  isDoclingReady,
  isWhisperReady,
  WHISPER_MISSING_MESSAGE,
} from "@/lib/desktop/component-availability";

export const runtime = "nodejs";

const FILE_TYPES: Record<SupportedExtension, FileType> = {
  pdf: FileType.PDF,
  pptx: FileType.PPTX,
  docx: FileType.DOCX,
  epub: FileType.EPUB,
  xmind: FileType.XMIND,
  png: FileType.IMAGE,
  jpg: FileType.IMAGE,
  jpeg: FileType.IMAGE,
  webp: FileType.IMAGE,
  mp3: FileType.AUDIO,
  wav: FileType.AUDIO,
  m4a: FileType.AUDIO,
};

function getExtension(fileName: string): SupportedExtension | null {
  const extension = path.extname(fileName).slice(1).toLowerCase();
  return extension in FILE_TYPES ? (extension as SupportedExtension) : null;
}

function hasExpectedSignature(buffer: Buffer, extension: SupportedExtension) {
  if (extension === "pdf") return buffer.subarray(0, 5).toString("utf8") === "%PDF-";
  if (["pptx", "docx", "epub", "xmind"].includes(extension)) {
    return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  }
  if (extension === "png") return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (extension === "jpg" || extension === "jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8;
  if (extension === "webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (extension === "wav") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WAVE";
  if (extension === "m4a") return buffer.subarray(4, 8).toString("ascii") === "ftyp";
  if (extension === "mp3") {
    return buffer.subarray(0, 3).toString("ascii") === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  }
  return false;
}

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ message: "Dữ liệu tải lên không hợp lệ. Hãy chọn lại file và thử lại." }, { status: 400 });
  }
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

  const isAudio = ["mp3", "wav", "m4a"].includes(extension);
  if (extension !== "xmind" && (isAudio ? !await isWhisperReady() : !await isDoclingReady())) {
    return NextResponse.json({
      message: isAudio ? WHISPER_MISSING_MESSAGE : DOCLING_MISSING_MESSAGE,
      setupUrl: "/settings/components",
    }, { status: 503 });
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

  if (extension === "xmind") {
    try { await readXmind(buffer); }
    catch (error) {
      return NextResponse.json({ message: error instanceof Error ? error.message : "Không đọc được XMind." }, { status: 422 });
    }
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
