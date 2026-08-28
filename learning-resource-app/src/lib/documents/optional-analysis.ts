export const OPTIONAL_ANALYSIS_NOTE = "Chưa kết nối AI tùy chọn. Tài liệu vẫn dùng để tìm kiếm; kết nối AI khi cần tóm tắt và phân loại.";

export function isSkippedAnalysisJob(job?: {
  type: string;
  status: string;
  errorMessage?: string | null;
}) {
  return job?.type === "ANALYZE_DOCUMENT" && (
    job.status === "SKIPPED" || (
      job.status === "FAILED" && job.errorMessage === "Chưa có kết nối AI đang hoạt động."
    )
  );
}
