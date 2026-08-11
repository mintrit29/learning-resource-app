import Link from "next/link";
import { FileStack, Filter, Search, Upload, X } from "lucide-react";
import { auth } from "@/auth";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ProcessingRefresh } from "@/components/documents/processing-refresh";
import { Difficulty, FileType, JobStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { getDocumentDisplayStatus } from "@/lib/documents/display-status";
import { ensureCurriculumTopics } from "@/lib/taxonomy/curriculum-topics";

const UNCLASSIFIED_FILTER = "__unclassified__";

const statusOptions = [
  { value: "READY", label: "Sẵn sàng" },
  { value: "FAILED", label: "Bị lỗi" },
] as const;

const difficultyLabels: Record<string, string> = {
  BEGINNER: "Cơ bản",
  INTERMEDIATE: "Trung cấp",
  ADVANCED: "Nâng cao",
};

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function pickEnumValue<T extends string>(value: string | undefined, values: readonly T[]) {
  return value && values.includes(value as T) ? (value as T) : undefined;
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; topic?: string; difficulty?: string; fileType?: string; status?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  await ensureCurriculumTopics(userId);
  const filters = await searchParams;
  const q = filters.q?.trim() ?? "";
  const topic = filters.topic?.trim() ?? "";
  const difficulty = pickEnumValue(filters.difficulty, Object.values(Difficulty));
  const fileType = pickEnumValue(filters.fileType, Object.values(FileType));
  const status = pickEnumValue(filters.status, statusOptions.map((option) => option.value));

  const where = {
    userId,
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { originalFileName: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(topic === UNCLASSIFIED_FILTER
      ? { primaryTopic: null }
      : topic
        ? { primaryTopic: topic }
        : {}),
    ...(difficulty ? { difficulty } : {}),
    ...(fileType ? { fileType } : {}),
  };

  const [documentRows, topics, totalDocuments, activeProcessingJobs] = await Promise.all([
    db.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        originalFileName: true,
        fileType: true,
        fileSize: true,
        status: true,
        textContent: true,
        primaryTopic: true,
        difficulty: true,
        createdAt: true,
        jobs: {
          orderBy: { createdAt: "asc" },
          select: { type: true, status: true, createdAt: true },
        },
      },
    }),
    db.tag.findMany({
      where: { createdByUserId: userId, isClassificationEnabled: true },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
    db.document.count({ where: { userId } }),
    db.analysisJob.count({
      where: {
        status: { in: [JobStatus.PENDING, JobStatus.PROCESSING] },
        document: { userId },
      },
    }),
  ]);

  const hasFilters = Boolean(q || topic || difficulty || fileType || status);
  const documents = status
    ? documentRows.filter((document) => {
        const displayStatus = getDocumentDisplayStatus(document, document.jobs);
        return status === "READY" ? displayStatus.isReadyToAsk : displayStatus.className === "failed";
      })
    : documentRows;

  return (
    <div className="page-wrap">
      <ProcessingRefresh active={activeProcessingJobs > 0} />
      <header className="page-header">
        <div>
          <p className="eyebrow">Tài liệu</p>
          <h1>Thư viện của bạn</h1>
          <p>Quản lý tài liệu đã thêm, xem trạng thái xử lý và mở lại kết quả phân tích.</p>
        </div>
        <Link className="primary-button compact" href="/upload">
          <Upload size={18} />
          Thêm tài liệu
        </Link>
      </header>

      {totalDocuments > 0 ? (
        <form className="filter-panel">
          <label className="filter-search">
            <Search size={18} />
            <input name="q" placeholder="Tìm theo tên file..." defaultValue={q} />
          </label>
          <label>
            <span>Môn học</span>
            <select name="topic" defaultValue={topic}>
              <option value="">Tất cả</option>
              <option value={UNCLASSIFIED_FILTER}>Chưa phân loại</option>
              {topics.map((item) => <option value={item.name} key={item.name}>{item.name}</option>)}
            </select>
          </label>
          <label>
            <span>Độ khó</span>
            <select name="difficulty" defaultValue={difficulty ?? ""}>
              <option value="">Tất cả</option>
              {Object.values(Difficulty).map((item) => (
                <option value={item} key={item}>
                  {difficultyLabels[item]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Loại file</span>
            <select name="fileType" defaultValue={fileType ?? ""}>
              <option value="">Tất cả</option>
              {Object.values(FileType).map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Trạng thái</span>
            <select name="status" defaultValue={status ?? ""}>
              <option value="">Tất cả</option>
              {statusOptions.map((item) => (
                <option value={item.value} key={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <button className="secondary-button compact-filter" type="submit">
            <Filter size={16} />
            Lọc
          </button>
          {hasFilters ? (
            <Link className="filter-clear" href="/documents">
              <X size={15} />
              Xóa lọc
            </Link>
          ) : null}
        </form>
      ) : null}

      {totalDocuments === 0 ? (
        <section className="content-section">
          <EmptyState
            icon={FileStack}
            title="Bạn chưa có tài liệu nào"
            description="Thêm PDF, DOCX, PPTX hoặc EPUB. ScholarFlow sẽ đọc nội dung, tạo dữ liệu tìm kiếm và phân tích để bạn hỏi lại sau."
            actionHref="/upload"
            actionLabel="Thêm tài liệu đầu tiên"
          />
        </section>
      ) : documents.length === 0 ? (
        <section className="content-section">
          <EmptyState
            icon={FileStack}
            title="Không có tài liệu khớp bộ lọc"
            description="Thử đổi từ khóa, môn học, độ khó, loại file hoặc trạng thái."
            actionHref="/documents"
            actionLabel="Xóa bộ lọc"
          />
        </section>
      ) : (
        <section className="document-table-wrap">
          <div className="document-table-header">
            <span>Tài liệu</span>
            <span>Loại</span>
            <span>Môn học</span>
            <span>Độ khó</span>
            <span>Trạng thái</span>
            <span>Ngày thêm</span>
          </div>
          <div className="document-rows">
            {documents.map((document) => {
              const displayStatus = getDocumentDisplayStatus(document, document.jobs);
              return (
                <Link className="document-row" href={`/documents/${document.id}`} key={document.id}>
                  <div className="document-name">
                    <span>{document.fileType}</span>
                    <div>
                      <strong>{document.title}</strong>
                      <small>
                        {formatBytes(document.fileSize)} · {document.originalFileName}
                      </small>
                    </div>
                  </div>
                  <span>{document.fileType}</span>
                  <span>{document.primaryTopic ?? "Chưa phân loại"}</span>
                  <span>{document.difficulty ? difficultyLabels[document.difficulty] : "Chưa rõ"}</span>
                  <span>
                    <i className={`status-dot ${displayStatus.className}`} />
                    {displayStatus.label}
                  </span>
                  <span>
                    {new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
                      document.createdAt,
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
