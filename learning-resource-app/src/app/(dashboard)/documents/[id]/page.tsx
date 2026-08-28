import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileText, LocateFixed } from "lucide-react";
import { DeleteDocumentButton } from "@/components/documents/delete-document-button";
import { DocumentPreviewFrame } from "@/components/documents/document-preview-frame";
import { EditAnalysisButton } from "@/components/documents/edit-analysis-button";
import { ExtractedTextDisclosure } from "@/components/documents/extracted-text-disclosure";
import { ProcessingEstimate } from "@/components/documents/processing-estimate";
import { ProcessingRefresh } from "@/components/documents/processing-refresh";
import { ReanalyzeButton } from "@/components/documents/reanalyze-button";
import { ReextractButton } from "@/components/documents/reextract-button";
import { RevealDocumentButton } from "@/components/documents/reveal-document-button";
import { RetryJobButton } from "@/components/documents/retry-job-button";
import { ScrollToMatchedChunk } from "@/components/documents/scroll-to-matched-chunk";
import { db } from "@/lib/db";
import { getDocumentDisplayStatus } from "@/lib/documents/display-status";
import { libraryReturnHref } from "@/lib/documents/library-navigation";
import { isSkippedAnalysisJob, OPTIONAL_ANALYSIS_NOTE } from "@/lib/documents/optional-analysis";
import { estimateProcessingRemaining } from "@/lib/documents/processing-estimate";
import { formatDifficulty, formatFileType } from "@/lib/labels";
import { ensureCurriculumTopics } from "@/lib/taxonomy/curriculum-topics";

export const dynamic = "force-dynamic";

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
  SKIPPED: "Bỏ qua (tùy chọn)",
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

export default async function DocumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chunk?: string; from?: string; mode?: string; returnTo?: string }>;
}) {
  await ensureCurriculumTopics();
  const { id } = await params;
  const { chunk: matchedChunkId, from, mode, returnTo } = await searchParams;
  const cameFromSearch = from === "search";
  const searchMode = mode === "visual" ? "visual" : "text";
  const backHref = cameFromSearch ? `/search${searchMode === "visual" ? "?mode=visual" : ""}` : libraryReturnHref(returnTo, id);
  const document = await db.document.findFirst({
    where: { id },
    include: {
      jobs: { orderBy: { createdAt: "asc" } },
      chunks: matchedChunkId
        ? { where: { id: matchedChunkId }, take: 1 }
        : { where: { id: "__none__" }, take: 1 },
      _count: { select: { chunks: true } },
    },
  });
  if (!document) notFound();

  const [missingEmbeddings, topics, activeProvider] = await Promise.all([
    db.documentChunk.count({ where: { documentId: document.id, embedding: null } }),
    db.tag.findMany({
      where: { isClassificationEnabled: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.aiProvider.findFirst({ where: { isActive: true }, select: { id: true } }),
  ]);

  const matchedChunk = document.chunks[0];
  const isProcessing = document.jobs.some((job) =>
    job.status === "PENDING" || job.status === "PROCESSING"
  );
  const analysisComplete = Boolean(document.difficulty && document.summary);
  const needsProcessing = !document.textContent || document._count.chunks === 0 ||
    missingEmbeddings > 0 || (Boolean(activeProvider) && !analysisComplete);
  const originalFileHref = `/api/documents/${document.id}/file`;
  const originalFileDownloadHref = `${originalFileHref}?download=1`;
  const extractedTextDownloadHref = `/api/documents/${document.id}/text`;
  const isPdf = document.fileType === "PDF";
  const isDirectPreview = isPdf || document.fileType === "IMAGE" || document.fileType === "AUDIO";
  const matchedPdfPage = isPdf && matchedChunk?.pageNumber ? matchedChunk.pageNumber : null;
  const matchedPreviewItem = !isPdf
    && ["PPTX", "EPUB", "XMIND"].includes(document.fileType)
    && matchedChunk?.pageNumber
    ? matchedChunk.pageNumber
    : null;
  const originalFilePreviewHref = isDirectPreview
    ? matchedPdfPage ? `${originalFileHref}#page=${matchedPdfPage}` : originalFileHref
    : `/api/documents/${document.id}/preview?${new URLSearchParams({
        ...(matchedPreviewItem ? { item: String(matchedPreviewItem) } : {}),
        ...(matchedChunk ? { chunk: matchedChunk.id } : {}),
      }).toString()}${matchedChunk ? "#matched-preview" : ""}`;
  const embeddingDevice = (process.env.EMBEDDING_DEVICE ?? "cpu").toLowerCase();
  const latestJobsByType = new Map<string, (typeof document.jobs)[number]>();
  for (const job of document.jobs) latestJobsByType.set(job.type, job);
  const embeddingJob = latestJobsByType.get("EMBED_DOCUMENT");
  const completedEmbeddings = Math.max(0, document._count.chunks - missingEmbeddings);
  const embeddingEstimate = embeddingJob?.status === "PROCESSING"
    ? estimateProcessingRemaining({
        totalItems: document._count.chunks,
        completedItems: completedEmbeddings,
        startedAt: embeddingJob.startedAt,
      })
    : null;
  const displayStatus = getDocumentDisplayStatus(document, document.jobs);

  return (
    <div className="page-wrap document-detail-page">
      <ProcessingRefresh active={isProcessing} />
      <Link className="back-link" href={backHref}><ArrowLeft size={17} />{cameFromSearch ? "Quay lại kết quả tìm kiếm" : "Quay lại thư viện"}</Link>
      <header className="document-detail-header">
        <div className="document-file-icon"><FileText size={26} /></div>
        <div><p className="eyebrow">Tài liệu {formatFileType(document.fileType)}</p><h1>{document.title}</h1><p>{document.originalFileName}</p></div>
        <div className="document-header-actions">
          {!isProcessing && needsProcessing ? <RetryJobButton documentId={document.id} /> : null}
          {!isProcessing ? <ReextractButton documentId={document.id} documentTitle={document.title} /> : null}
          {!isProcessing && document.textContent && activeProvider ? <ReanalyzeButton documentId={document.id} /> : null}
          <span className={`status-pill ${displayStatus.className}`}><i className="status-dot" />{displayStatus.label}</span>
          <DeleteDocumentButton documentId={document.id} documentTitle={document.title} />
        </div>
      </header>

      {!activeProvider && !analysisComplete && document.textContent ? (
        <p className="foundation-note">{OPTIONAL_ANALYSIS_NOTE} <Link href="/settings/ai-providers">Kết nối AI tùy chọn</Link></p>
      ) : null}

      {document.summary ? (
        <section className="document-analysis-section">
          <div className="analysis-heading">
            <div><p className="eyebrow">Phân tích AI</p><h2>Tóm tắt</h2></div>
            <EditAnalysisButton documentId={document.id} topics={topics} initial={{ topicId: topics.find((topic) => topic.name === document.primaryTopic)?.id ?? "", difficulty: document.difficulty ?? "INTERMEDIATE", language: document.language ?? "Unknown", summary: document.summary, reason: document.analysisReason ?? "Người dùng cập nhật kết quả phân loại" }} />
          </div>
          <p>{document.summary}</p>
        </section>
      ) : null}

      <section className="document-meta-strip">
        <div><span>Kích thước</span><strong>{formatBytes(document.fileSize)}</strong></div>
        <div><span>Ký tự đã trích xuất</span><strong>{document.textContent?.length.toLocaleString("vi-VN") ?? 0}</strong></div>
        <div><span>Môn học</span><strong>{document.primaryTopic ?? "Chưa phân loại"}</strong></div>
        <div><span>Độ khó</span><strong>{document.difficulty ? formatDifficulty(document.difficulty) : "Chưa phân tích"}</strong></div>
        <div><span>Ngôn ngữ</span><strong>{document.language ?? "Chưa nhận diện"}</strong></div>
      </section>

      <details className="processing-section document-disclosure" open={isProcessing}>
        <summary className="processing-heading">
          <div><h2>Tiến trình xử lý</h2><p>{document._count.chunks.toLocaleString("vi-VN")} đoạn đã được tạo.</p></div>
          <div className="processing-side">
            {embeddingJob?.status === "PROCESSING" ? (
              <ProcessingEstimate
                completedItems={completedEmbeddings}
                device={embeddingDevice}
                initialItemsPerMinute={embeddingEstimate?.itemsPerMinute ?? null}
                jobId={embeddingJob.id}
                progress={embeddingJob.progress}
                totalItems={document._count.chunks}
                updatedAt={embeddingJob.updatedAt.toISOString()}
              />
            ) : null}
            {isProcessing ? <span className="processing-live"><i />Đang chạy</span> : null}
          </div>
        </summary>
        <div className="job-list">
          {processingSteps.map((type) => {
            const job = latestJobsByType.get(type);
            const skipped = isSkippedAnalysisJob(job);
            const status = skipped ? "SKIPPED" : job?.status ?? "PENDING";
            return (
              <div className="job-row" key={type}>
                <i className={`status-dot ${skipped ? "ready" : status.toLowerCase()}`} />
                <div><strong>{jobLabels[type]}</strong>{skipped ? <small>{activeProvider ? "Lần xử lý trước chưa có kết nối AI. Bạn có thể bấm Phân tích AI lại." : OPTIONAL_ANALYSIS_NOTE}</small> : job?.errorMessage ? <small>{job.errorMessage}</small> : null}</div>
                <span className="job-result">{job ? jobStatusLabels[status] : "Chưa chạy"}</span>
              </div>
            );
          })}
        </div>
      </details>

      {matchedChunk ? (
        <section className="matched-chunk" id="matched-chunk">
          <ScrollToMatchedChunk enabled={cameFromSearch} />
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
                : isDirectPreview
                ? `${document.fileType === "AUDIO" ? "Âm thanh" : document.fileType === "IMAGE" ? "Ảnh mind map" : "PDF"} có thể xem trực tiếp trong app.`
                : document.fileType === "XMIND"
                ? "XMind hiển thị sơ đồ nhánh, ghi chú, nhãn và ảnh nhúng PNG/JPEG/WebP. Bố cục được tự sắp xếp; liên kết chéo chưa được hiển thị. File gốc vẫn được giữ nguyên."
                : `${document.fileType} được chuyển thành bản xem nhanh và hiển thị ngay trong app. Bố cục phức tạp có thể khác nhẹ so với phần mềm gốc.`}
            </p>
          </div>
          <div className="original-file-actions">
            <RevealDocumentButton documentId={document.id} />
            <a className="secondary-button compact" href={originalFileDownloadHref}>
              Lưu bản sao <Download size={15} />
            </a>
          </div>
        </div>
        <DocumentPreviewFrame
          fileType={document.fileType}
          direct={isDirectPreview}
          matched={Boolean(matchedChunk)}
          src={originalFilePreviewHref}
          title={`Bản xem: ${document.originalFileName}`}
        />
      </section>

      {document.status === "FAILED" ? (
        <section className="extraction-error">
          <div className="text-preview-heading">
            <div>
              <strong>Không thể trích xuất nội dung</strong>
              <p>{document.analysisReason ?? "File có thể không chứa text hoặc định dạng không hợp lệ."}</p>
            </div>
            <RevealDocumentButton documentId={document.id} />
          </div>
        </section>
      ) : (
        <ExtractedTextDisclosure
          characterCount={document.textContent?.length ?? 0}
          documentId={document.id}
          downloadHref={extractedTextDownloadHref}
          hasText={Boolean(document.textContent)}
        />
      )}
    </div>
  );
}
