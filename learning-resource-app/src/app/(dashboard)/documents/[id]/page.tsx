import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, LocateFixed } from "lucide-react";
import { auth } from "@/auth";
import { DeleteDocumentButton } from "@/components/documents/delete-document-button";
import { EditAnalysisButton } from "@/components/documents/edit-analysis-button";
import { ProcessingRefresh } from "@/components/documents/processing-refresh";
import { RetryJobButton } from "@/components/documents/retry-job-button";
import { db } from "@/lib/db";

const statusLabels: Record<string, string> = {
  UPLOADED: "Đã tải lên",
  EXTRACTING: "Đang trích xuất",
  EXTRACTED: "Đã trích xuất",
  ANALYZING: "Đang phân tích",
  READY: "Sẵn sàng",
  FAILED: "Trích xuất thất bại",
};

const jobLabels: Record<string, string> = {
  EXTRACT_TEXT: "Trích xuất nội dung",
  CHUNK_DOCUMENT: "Chia nội dung thành chunks",
  EMBED_DOCUMENT: "Tạo vector embedding",
  ANALYZE_DOCUMENT: "Phân tích bằng AI",
};

const jobStatusLabels: Record<string, string> = {
  PENDING: "Đang chờ",
  PROCESSING: "Đang xử lý",
  COMPLETED: "Hoàn thành",
  FAILED: "Thất bại",
};

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default async function DocumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chunk?: string }>;
}) {
  const session = await auth();
  const { id } = await params;
  const { chunk: matchedChunkId } = await searchParams;
  const document = await db.document.findFirst({
    where: { id, userId: session!.user.id },
    include: {
      jobs: { orderBy: { createdAt: "asc" } },
      chunks: matchedChunkId
        ? { where: { id: matchedChunkId }, take: 1 }
        : { where: { id: "__none__" }, take: 1 },
      _count: { select: { chunks: true } },
    },
  });
  if (!document) notFound();

  const [{ missing: missingEmbeddings }] = await db.$queryRawUnsafe<Array<{ missing: bigint }>>(
    `SELECT COUNT(*) AS "missing" FROM "DocumentChunk" WHERE "documentId" = $1 AND "embedding" IS NULL`,
    document.id,
  );

  const preview = document.textContent?.slice(0, 15000) ?? "";
  const matchedChunk = document.chunks[0];
  const isProcessing = document.jobs.some((job) =>
    job.status === "PENDING" || job.status === "PROCESSING"
  );
  const analysisComplete = Boolean(
    document.primaryTopic && document.difficulty && document.summary &&
    document.subtopics.length && document.keywords.length,
  );
  const needsProcessing = !document.textContent || document._count.chunks === 0 ||
    Number(missingEmbeddings) > 0 || !analysisComplete;

  return (
    <div className="page-wrap document-detail-page">
      <ProcessingRefresh active={isProcessing} />
      <Link className="back-link" href="/documents"><ArrowLeft size={17} />Quay lại thư viện</Link>
      <header className="document-detail-header">
        <div className="document-file-icon"><FileText size={26} /></div>
        <div><p className="eyebrow">{document.fileType} document</p><h1>{document.title}</h1><p>{document.originalFileName}</p></div>
        <div className="document-header-actions">
          {!isProcessing && needsProcessing ? <RetryJobButton documentId={document.id} /> : null}
          <span className={`status-pill ${document.status.toLowerCase()}`}><i className="status-dot" />{statusLabels[document.status]}</span>
          <DeleteDocumentButton documentId={document.id} documentTitle={document.title} />
        </div>
      </header>

      {document.summary ? (
        <section className="document-analysis-section">
          <div className="analysis-heading"><div><p className="eyebrow">Phân tích AI</p><h2>Tóm tắt</h2></div><EditAnalysisButton documentId={document.id} initial={{ topic: document.primaryTopic ?? "Other", difficulty: document.difficulty ?? "INTERMEDIATE", summary: document.summary, subtopics: document.subtopics, keywords: document.keywords, reason: document.analysisReason ?? "Người dùng cập nhật kết quả phân loại" }} /></div>
          <p>{document.summary}</p>
          <div><strong>Chủ đề con</strong><div className="analysis-tags">{document.subtopics.map((item) => <span key={item}>{item}</span>)}</div></div>
          <div><strong>Từ khóa</strong><div className="analysis-tags muted">{document.keywords.map((item) => <span key={item}>{item}</span>)}</div></div>
        </section>
      ) : null}

      <section className="document-meta-strip">
        <div><span>Kích thước</span><strong>{formatBytes(document.fileSize)}</strong></div>
        <div><span>Ký tự đã trích xuất</span><strong>{document.textContent?.length.toLocaleString("vi-VN") ?? 0}</strong></div>
        <div><span>Chủ đề</span><strong>{document.primaryTopic ?? "Chưa phân tích"}</strong></div>
        <div><span>Độ khó</span><strong>{document.difficulty ?? "Chưa phân tích"}</strong></div>
      </section>

      <section className="processing-section">
        <div className="processing-heading">
          <div><h2>Tiến trình xử lý</h2><p>{document._count.chunks.toLocaleString("vi-VN")} chunks đã được tạo.</p></div>
          {isProcessing ? <span className="processing-live"><i />Đang chạy</span> : null}
        </div>
        <div className="job-list">
          {document.jobs.length ? document.jobs.map((job) => (
            <div className="job-row" key={job.id}>
              <i className={`status-dot ${job.status.toLowerCase()}`} />
              <div><strong>{jobLabels[job.type]}</strong>{job.errorMessage ? <small>{job.errorMessage}</small> : null}</div>
              <span className="job-result">{jobStatusLabels[job.status]}</span>
            </div>
          )) : <p>Đây là tài liệu được tạo trước khi hệ thống job được bổ sung.</p>}
        </div>
      </section>

      {matchedChunk ? (
        <section className="matched-chunk" id="matched-chunk">
          <div className="matched-chunk-heading">
            <span><LocateFixed size={21} /></span>
            <div><p className="eyebrow">Đoạn khớp với tìm kiếm</p><h2>{matchedChunk.sourceLabel ?? "Vị trí chưa xác định"}</h2></div>
            {document.fileType === "PDF" && matchedChunk.pageNumber ? (
              <a className="secondary-button" href={`/api/documents/${document.id}/file#page=${matchedChunk.pageNumber}`} target="_blank" rel="noreferrer">Mở trang {matchedChunk.pageNumber}<ExternalLink size={16} /></a>
            ) : null}
          </div>
          <pre>{matchedChunk.content}</pre>
        </section>
      ) : null}

      {document.status === "FAILED" ? (
        <section className="extraction-error"><strong>Không thể trích xuất nội dung</strong><p>{document.analysisReason ?? "File có thể không chứa text hoặc định dạng không hợp lệ."}</p></section>
      ) : (
        <section className="text-preview-section">
          <div><h2>Nội dung đã trích xuất</h2><p>Hiển thị tối đa 15.000 ký tự đầu tiên.</p></div>
          <pre>{preview || "Nội dung đang được xử lý..."}</pre>
          {document.textContent && document.textContent.length > preview.length ? <small>Còn {document.textContent.length - preview.length} ký tự chưa hiển thị.</small> : null}
        </section>
      )}
    </div>
  );
}
