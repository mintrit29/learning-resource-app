import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, ExternalLink, FileText, LocateFixed } from "lucide-react";
import { auth } from "@/auth";
import { DeleteDocumentButton } from "@/components/documents/delete-document-button";
import { EditAnalysisButton } from "@/components/documents/edit-analysis-button";
import { ProcessingRefresh } from "@/components/documents/processing-refresh";
import { ReanalyzeButton } from "@/components/documents/reanalyze-button";
import { RetryJobButton } from "@/components/documents/retry-job-button";
import { db } from "@/lib/db";
import { getDocumentDisplayStatus } from "@/lib/documents/display-status";
import { formatDifficulty } from "@/lib/labels";

const jobLabels: Record<string, string> = {
  EXTRACT_TEXT: "Trích xuất nội dung",
  CHUNK_DOCUMENT: "Chia nội dung thành đoạn",
  EMBED_DOCUMENT: "Tạo vector embedding",
  ANALYZE_DOCUMENT: "Phân tích bằng AI",
};

const jobStatusLabels: Record<string, string> = {
  PENDING: "Đang chờ",
  PROCESSING: "Đang xử lý",
  COMPLETED: "Hoàn thành",
  FAILED: "Thất bại",
};

const processingSteps = [
  "EXTRACT_TEXT",
  "CHUNK_DOCUMENT",
  "EMBED_DOCUMENT",
  "ANALYZE_DOCUMENT",
] as const;

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function estimateEmbeddingSeconds(chunks: number, device: string) {
  if (chunks <= 0) return null;
  const secondsPerChunk = device === "cuda" ? 0.95 : 1.6;
  return Math.max(10, Math.round(chunks * secondsPerChunk));
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `khoảng ${seconds} giây`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `khoảng ${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `khoảng ${hours} giờ ${remainingMinutes} phút` : `khoảng ${hours} giờ`;
}

export default async function DocumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chunk?: string; fullText?: string }>;
}) {
  const session = await auth();
  const { id } = await params;
  const { chunk: matchedChunkId, fullText } = await searchParams;
  const shouldShowFullText = fullText === "1";
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

  const textContent = document.textContent ?? "";
  const previewLimit = 15000;
  const preview = shouldShowFullText ? textContent : textContent.slice(0, previewLimit);
  const hiddenCharacterCount = Math.max(0, textContent.length - preview.length);
  const matchedChunk = document.chunks[0];
  const isProcessing = document.jobs.some((job) =>
    job.status === "PENDING" || job.status === "PROCESSING"
  );
  const analysisComplete = Boolean(document.primaryTopic && document.difficulty && document.summary);
  const needsProcessing = !document.textContent || document._count.chunks === 0 ||
    Number(missingEmbeddings) > 0 || !analysisComplete;
  const originalFileHref = `/api/documents/${document.id}/file`;
  const originalFileDownloadHref = `${originalFileHref}?download=1`;
  const extractedTextDownloadHref = `/api/documents/${document.id}/text`;
  const textViewParams = new URLSearchParams();
  if (matchedChunkId) textViewParams.set("chunk", matchedChunkId);
  if (!shouldShowFullText) textViewParams.set("fullText", "1");
  const textViewHref = `/documents/${document.id}${textViewParams.size ? `?${textViewParams.toString()}` : ""}#extracted-text`;
  const canPreviewOriginalFile = document.fileType === "PDF";
  const matchedPdfPage = canPreviewOriginalFile && matchedChunk?.pageNumber ? matchedChunk.pageNumber : null;
  const originalFilePreviewHref = matchedPdfPage ? `${originalFileHref}#page=${matchedPdfPage}` : originalFileHref;
  const originalFileActionLabel = canPreviewOriginalFile ? "Mở file gốc" : "Tải file gốc";
  const embeddingDevice = (process.env.EMBEDDING_DEVICE ?? "cpu").toLowerCase();
  const embeddingBatchSize = process.env.EMBEDDING_BATCH_SIZE ?? (embeddingDevice === "cuda" ? "2" : "4");
  const embeddingEstimate = estimateEmbeddingSeconds(document._count.chunks, embeddingDevice);
  const latestJobsByType = new Map<string, (typeof document.jobs)[number]>();
  for (const job of document.jobs) latestJobsByType.set(job.type, job);
  const displayStatus = getDocumentDisplayStatus(document, document.jobs);

  return (
    <div className="page-wrap document-detail-page">
      <ProcessingRefresh active={isProcessing} />
      <Link className="back-link" href="/documents"><ArrowLeft size={17} />Quay lại thư viện</Link>
      <header className="document-detail-header">
        <div className="document-file-icon"><FileText size={26} /></div>
        <div><p className="eyebrow">Tài liệu {document.fileType}</p><h1>{document.title}</h1><p>{document.originalFileName}</p></div>
        <div className="document-header-actions">
          {!isProcessing && needsProcessing ? <RetryJobButton documentId={document.id} /> : null}
          {!isProcessing && document.textContent ? <ReanalyzeButton documentId={document.id} /> : null}
          <span className={`status-pill ${displayStatus.className}`}><i className="status-dot" />{displayStatus.label}</span>
          <DeleteDocumentButton documentId={document.id} documentTitle={document.title} />
        </div>
      </header>

      {document.summary ? (
        <section className="document-analysis-section">
          <div className="analysis-heading">
            <div><p className="eyebrow">Phân tích AI</p><h2>Tóm tắt</h2></div>
            <EditAnalysisButton documentId={document.id} initial={{ topic: document.primaryTopic ?? "Other", difficulty: document.difficulty ?? "INTERMEDIATE", language: document.language ?? "Unknown", summary: document.summary, reason: document.analysisReason ?? "Người dùng cập nhật kết quả phân loại" }} />
          </div>
          <p>{document.summary}</p>
        </section>
      ) : null}

      <section className="document-meta-strip">
        <div><span>Kích thước</span><strong>{formatBytes(document.fileSize)}</strong></div>
        <div><span>Ký tự đã trích xuất</span><strong>{document.textContent?.length.toLocaleString("vi-VN") ?? 0}</strong></div>
        <div><span>Chủ đề</span><strong>{document.primaryTopic ?? "Chưa phân tích"}</strong></div>
        <div><span>Độ khó</span><strong>{document.difficulty ? formatDifficulty(document.difficulty) : "Chưa phân tích"}</strong></div>
        <div><span>Ngôn ngữ</span><strong>{document.language ?? "Chưa nhận diện"}</strong></div>
      </section>

      <section className="processing-section">
        <div className="processing-heading">
          <div><h2>Tiến trình xử lý</h2><p>{document._count.chunks.toLocaleString("vi-VN")} đoạn đã được tạo.</p></div>
          <div className="processing-side">
            {embeddingEstimate ? (
              <span className="processing-estimate">
                Tạo vector {embeddingDevice === "cuda" ? "GPU" : "CPU"} · lô {embeddingBatchSize} · {formatDuration(embeddingEstimate)}
              </span>
            ) : null}
            {isProcessing ? <span className="processing-live"><i />Đang chạy</span> : null}
          </div>
        </div>
        <div className="job-list">
          {processingSteps.map((type) => {
            const job = latestJobsByType.get(type);
            const status = job?.status ?? "PENDING";
            return (
              <div className="job-row" key={type}>
                <i className={`status-dot ${status.toLowerCase()}`} />
                <div><strong>{jobLabels[type]}</strong>{job?.errorMessage ? <small>{job.errorMessage}</small> : null}</div>
                <span className="job-result">{job ? jobStatusLabels[status] : "Chưa chạy"}</span>
              </div>
            );
          })}
        </div>
      </section>

      {matchedChunk ? (
        <section className="matched-chunk" id="matched-chunk">
          <div className="matched-chunk-heading">
            <span><LocateFixed size={21} /></span>
            <div><p className="eyebrow">Đoạn khớp với tìm kiếm</p><h2>{matchedChunk.sourceLabel ?? "Vị trí chưa xác định"}</h2></div>
          </div>
          <pre>{matchedChunk.content}</pre>
        </section>
      ) : null}

      <section className="original-file-section" id="original-file">
        <div className="text-preview-heading">
          <div>
            <h2>File gốc</h2>
            <p>
              {matchedPdfPage
                ? `PDF đang mở sẵn trang ${matchedPdfPage}, trùng với đoạn khớp phía trên.`
                : canPreviewOriginalFile
                ? "PDF có thể xem trực tiếp trong app. Nếu muốn kiểm tra bằng tab riêng, bấm mở file gốc."
                : "Trình duyệt thường không xem trực tiếp DOCX/PPTX/EPUB, nên app sẽ tải file gốc để bạn mở bằng phần mềm phù hợp."}
            </p>
          </div>
          <div className="original-file-actions">
            {canPreviewOriginalFile ? (
              <a className="secondary-button compact" href={originalFilePreviewHref} target="_blank" rel="noreferrer">
                {matchedPdfPage ? `Mở trang ${matchedPdfPage}` : "Mở tab riêng"} <ExternalLink size={15} />
              </a>
            ) : null}
            <a className="secondary-button compact" href={originalFileDownloadHref}>
              Tải file <Download size={15} />
            </a>
          </div>
        </div>
        {canPreviewOriginalFile ? (
          <iframe
            className="pdf-preview-frame"
            src={originalFilePreviewHref}
            title={`File gốc: ${document.originalFileName}`}
          />
        ) : (
          <div className="file-download-card">
            <FileText size={28} />
            <div>
              <strong>{document.originalFileName}</strong>
              <p>{document.fileType} · {formatBytes(document.fileSize)}</p>
            </div>
          </div>
        )}
      </section>

      {document.status === "FAILED" ? (
        <section className="extraction-error">
          <div className="text-preview-heading">
            <div>
              <strong>Không thể trích xuất nội dung</strong>
              <p>{document.analysisReason ?? "File có thể không chứa text hoặc định dạng không hợp lệ."}</p>
            </div>
            <a
              className="secondary-button compact"
              href={canPreviewOriginalFile ? originalFileHref : originalFileDownloadHref}
              target={canPreviewOriginalFile ? "_blank" : undefined}
              rel={canPreviewOriginalFile ? "noreferrer" : undefined}
            >
              {originalFileActionLabel} {canPreviewOriginalFile ? <ExternalLink size={15} /> : <Download size={15} />}
            </a>
          </div>
        </section>
      ) : (
        <section className="text-preview-section" id="extracted-text">
          <div className="text-preview-heading">
            <div>
              <h2>Nội dung đã trích xuất</h2>
              <p>
                {document.textContent
                  ? shouldShowFullText
                    ? `Đang hiển thị toàn bộ ${document.textContent.length.toLocaleString("vi-VN")} ký tự để bạn kiểm tra nội dung bị miss.`
                    : `Đang xem nhanh ${preview.length.toLocaleString("vi-VN")} / ${document.textContent.length.toLocaleString("vi-VN")} ký tự.`
                  : "Nội dung đang được xử lý..."}
              </p>
            </div>
            {document.textContent ? (
              <div className="original-file-actions">
                <Link className="secondary-button compact" href={textViewHref}>
                  {shouldShowFullText ? "Thu gọn" : "Xem toàn bộ"}
                </Link>
                <a className="secondary-button compact" href={extractedTextDownloadHref}>
                  Tải .txt <Download size={15} />
                </a>
              </div>
            ) : null}
          </div>
          <pre>{preview || "Nội dung đang được xử lý..."}</pre>
          {hiddenCharacterCount > 0 ? <small>Còn {hiddenCharacterCount.toLocaleString("vi-VN")} ký tự chưa hiển thị.</small> : null}
        </section>
      )}
    </div>
  );
}
