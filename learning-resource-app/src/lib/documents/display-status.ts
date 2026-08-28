import { DocumentStatus, JobStatus, JobType } from "@/generated/prisma/enums";
import { isSkippedAnalysisJob } from "./optional-analysis";

type JobLike = {
  type: JobType | string;
  status: JobStatus | string;
  createdAt?: Date;
  errorMessage?: string | null;
};

type DocumentLike = {
  status: DocumentStatus | string;
  textContent?: string | null;
};

export type DisplayStatus = {
  label: string;
  className: string;
  isReadyToAsk: boolean;
};

const latestByType = (jobs: JobLike[]) => {
  const sortedJobs = [...jobs].sort((a, b) => {
    const aTime = a.createdAt?.getTime() ?? 0;
    const bTime = b.createdAt?.getTime() ?? 0;
    return aTime - bTime;
  });
  const map = new Map<string, JobLike>();
  for (const job of sortedJobs) map.set(job.type, job);
  return map;
};

function isRunning(status?: string) {
  return status === JobStatus.PROCESSING || status === JobStatus.PENDING;
}

export function getDocumentDisplayStatus(document: DocumentLike, jobs: JobLike[]): DisplayStatus {
  const latestJobs = latestByType(jobs);
  const extractJob = latestJobs.get(JobType.EXTRACT_TEXT);
  const chunkJob = latestJobs.get(JobType.CHUNK_DOCUMENT);
  const embeddingJob = latestJobs.get(JobType.EMBED_DOCUMENT);
  const analysisJob = latestJobs.get(JobType.ANALYZE_DOCUMENT);

  if (document.status === DocumentStatus.FAILED || extractJob?.status === JobStatus.FAILED) {
    return { label: "Bị lỗi", className: "failed", isReadyToAsk: false };
  }

  if (!document.textContent || isRunning(extractJob?.status)) {
    return { label: "Đang đọc nội dung", className: "processing", isReadyToAsk: false };
  }

  if (chunkJob?.status === JobStatus.FAILED) {
    return { label: "Lỗi chia đoạn", className: "failed", isReadyToAsk: false };
  }

  if (isRunning(chunkJob?.status)) {
    return { label: "Đang chia đoạn", className: "processing", isReadyToAsk: false };
  }

  if (embeddingJob?.status === JobStatus.FAILED) {
    return { label: "Lỗi tạo tìm kiếm", className: "failed", isReadyToAsk: false };
  }

  if (isRunning(embeddingJob?.status) || embeddingJob?.status !== JobStatus.COMPLETED) {
    return { label: "Đang tạo tìm kiếm", className: "processing", isReadyToAsk: false };
  }

  if (isRunning(analysisJob?.status)) {
    return { label: "Đang phân tích AI", className: "processing", isReadyToAsk: false };
  }

  if (isSkippedAnalysisJob(analysisJob)) {
    return { label: "Sẵn sàng tìm kiếm · Chưa phân tích AI", className: "ready", isReadyToAsk: true };
  }

  if (analysisJob?.status === JobStatus.FAILED) {
    return { label: "Tìm được, phân tích AI lỗi", className: "warning", isReadyToAsk: true };
  }

  return { label: "Sẵn sàng để tìm kiếm", className: "ready", isReadyToAsk: true };
}
