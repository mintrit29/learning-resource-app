import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  FileStack,
  Search,
  ServerCog,
  Sparkles,
} from "lucide-react";
import { ProcessingRefresh } from "@/components/documents/processing-refresh";
import { DocumentStatus, JobStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { getDocumentDisplayStatus } from "@/lib/documents/display-status";
import { formatDifficulty } from "@/lib/labels";
import { ensureCurriculumTopics } from "@/lib/taxonomy/curriculum-topics";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  UPLOADED: "Đã tải lên",
  EXTRACTING: "Đang đọc file",
  EXTRACTED: "Đã đọc nội dung",
  ANALYZING: "Đang phân tích",
  READY: "Sẵn sàng",
  FAILED: "Bị lỗi",
};

function getProviderStatus(provider: { displayName: string; type: string; authStatus: string } | null) {
  if (!provider) {
    return {
      isConnected: false,
      value: "Chưa có",
      detail: "Tùy chọn: tóm tắt và phân loại",
      stepHint: "Không bắt buộc để thêm hoặc tìm tài liệu.",
    };
  }

  if (provider.authStatus === "CONNECTED") {
    return {
      isConnected: true,
      value: "OK",
      detail: `${provider.displayName} (${provider.type})`,
      stepHint: `Đang dùng ${provider.displayName}`,
    };
  }

  if (provider.authStatus === "ERROR") {
    return {
      isConnected: false,
      value: "Lỗi",
      detail: `${provider.displayName} chưa kết nối được`,
      stepHint: `${provider.displayName} đang lỗi, cần kiểm tra lại.`,
    };
  }

  return {
    isConnected: false,
    value: "Chưa kiểm tra",
    detail: `${provider.displayName} cần test kết nối`,
    stepHint: `${provider.displayName} chưa được kiểm tra.`,
  };
}

export default async function DashboardPage() {
  await ensureCurriculumTopics();
  const [
    documentCount,
    processedCount,
    recentDocuments,
    topicRows,
    difficultyRows,
    statusRows,
    activeProvider,
    activeProcessingJobs,
  ] = await Promise.all([
    db.document.count(),
    db.document.count({
      where: {
        status: DocumentStatus.READY,
        jobs: { none: { status: { in: [JobStatus.PENDING, JobStatus.PROCESSING] } } },
      },
    }),
    db.document.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        originalFileName: true,
        fileType: true,
        status: true,
        textContent: true,
        createdAt: true,
        jobs: {
          orderBy: { createdAt: "asc" },
          select: { type: true, status: true, createdAt: true, errorMessage: true },
        },
      },
    }),
    db.document.groupBy({
      by: ["primaryTopic"],
      where: { primaryTopic: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { primaryTopic: "desc" } },
      take: 6,
    }),
    db.document.groupBy({
      by: ["difficulty"],
      where: { difficulty: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { difficulty: "desc" } },
    }),
    db.document.groupBy({
      by: ["status"],
      _count: { _all: true },
      orderBy: { _count: { status: "desc" } },
    }),
    db.aiProvider.findFirst({
      where: { isActive: true },
      select: { displayName: true, type: true, authStatus: true },
    }),
    db.analysisJob.count({
      where: {
        status: { in: [JobStatus.PENDING, JobStatus.PROCESSING] },
      },
    }),
  ]);

  const maxTopicCount = Math.max(1, ...topicRows.map((row) => row._count._all));
  const maxDifficultyCount = Math.max(1, ...difficultyRows.map((row) => row._count._all));
  const processedRate = documentCount ? Math.round((processedCount / documentCount) * 100) : 0;
  const visibleStatusRows = statusRows.filter((row) => row.status === "FAILED");
  const providerStatus = getProviderStatus(activeProvider);

  const nextAction = documentCount === 0
      ? {
          label: "Thêm tài liệu đầu tiên",
      helper: "Tải tài liệu, ảnh mind map hoặc âm thanh để bắt đầu xây thư viện.",
        }
      : {
          label: "Tìm tài liệu",
          helper: "Mô tả nhu cầu, ví dụ: “tài liệu nền tảng về SQL cho người mới”.",
        };
  const metrics = [
    {
      label: "Tài liệu",
      value: documentCount,
      detail: documentCount ? "Đang có trong thư viện" : "Chưa có tài liệu",
      icon: FileStack,
    },
    {
      label: "Đã xử lý xong",
      value: `${processedRate}%`,
      detail: `${processedCount}/${documentCount} tài liệu đã hoàn tất xử lý`,
      icon: Sparkles,
    },
    {
      label: "Kết nối AI (tùy chọn)",
      value: providerStatus.value,
      detail: providerStatus.detail,
      icon: ServerCog,
    },
  ];

  return (
    <div className="page-wrap">
      <ProcessingRefresh active={activeProcessingJobs > 0} />
      <header className="page-header">
        <div>
          <p className="eyebrow">Tổng quan</p>
          <h1>Hôm nay bạn muốn làm gì với tài liệu?</h1>
          <p>
            ScholarFlow giúp bạn thêm tài liệu, tự phân tích nội dung và tìm lại kiến thức
            bằng nhu cầu học tập hoặc Research Project của bạn.
          </p>
        </div>
      </header>

      <section className="onboarding-card">
        <div>
          <p className="eyebrow">Bắt đầu nhanh</p>
          <h2>{nextAction.label}</h2>
          <p>{nextAction.helper}</p>
        </div>
        <ol className="onboarding-steps">
          <li className={providerStatus.isConnected ? "done" : ""}>
            <span>{providerStatus.isConnected ? <CheckCircle2 size={17} /> : <Sparkles size={17} />}</span>
            <div>
              <strong>AI tùy chọn</strong>
              <small>{providerStatus.stepHint}</small>
            </div>
            {!providerStatus.isConnected ? <Link href="/settings/ai-providers">{activeProvider ? "Kiểm tra" : "Thiết lập"}</Link> : null}
          </li>
          <li className={documentCount > 0 ? "done" : "current"}>
            <span>{documentCount > 0 ? <CheckCircle2 size={17} /> : "1"}</span>
            <div>
              <strong>Thêm tài liệu</strong>
              <small>{documentCount > 0 ? `${documentCount} tài liệu trong thư viện` : "Tài liệu, ảnh mind map hoặc âm thanh."}</small>
            </div>
            {documentCount === 0 ? <Link href="/upload">Thêm file</Link> : null}
          </li>
          <li className={documentCount > 0 ? "current" : ""}>
            <span>2</span>
            <div>
              <strong>Tìm tài liệu</strong>
              <small>Tìm nguồn theo môn học, độ khó và nhu cầu nghiên cứu.</small>
            </div>
            {documentCount > 0 ? <Link href="/search">Bắt đầu tìm</Link> : null}
          </li>
        </ol>
      </section>

      <section className="metrics-grid" aria-label="Thống kê">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article className="metric" key={metric.label}>
              <div className="metric-top">
                <span>{metric.label}</span>
                <Icon size={20} />
              </div>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </article>
          );
        })}
      </section>

      <section className="dashboard-grid">
        <div className="content-section recent-section">
          <div className="section-heading">
            <div>
              <h2>Tài liệu gần đây</h2>
              <p>Các file mới được thêm vào thư viện.</p>
            </div>
            <Link href="/documents">
              Xem tất cả <ArrowUpRight size={16} />
            </Link>
          </div>
          {recentDocuments.length === 0 ? (
            <div className="inline-empty">
              <BookOpen size={22} />
              <p>Chưa có tài liệu nào.</p>
              <Link href="/upload">Thêm tài liệu đầu tiên</Link>
            </div>
          ) : (
            <div className="recent-documents">
              {recentDocuments.map((document) => {
                const displayStatus = getDocumentDisplayStatus(document, document.jobs);
                return (
                  <Link href={`/documents/${document.id}`} key={document.id}>
                    <span>{document.fileType}</span>
                    <div>
                      <strong>{document.title}</strong>
                      <small>{displayStatus.isReadyToAsk ? document.originalFileName : displayStatus.label}</small>
                    </div>
                    <time>
                      {new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(document.createdAt)}
                    </time>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        <aside className="getting-started">
          <p className="eyebrow">Mẹo sử dụng</p>
          <h2>Không cần nhớ đúng từ khóa trong tài liệu</h2>
          <ol>
            <li>
              <span>
                <Search size={16} />
              </span>
              <p>
                <strong>Mô tả nguồn bạn cần</strong>
                <small>Ví dụ: “tài liệu giải thích transaction trong database cho người mới”.</small>
              </p>
            </li>
            <li>
              <span>
                <ArrowUpRight size={16} />
              </span>
              <p>
                <strong>Mở đúng đoạn liên quan</strong>
                <small>Kết quả tìm kiếm sẽ dẫn tới chunk/page đã khớp.</small>
              </p>
            </li>
            <li>
              <span>
                <Sparkles size={16} />
              </span>
              <p>
                <strong>Chọn tài liệu để đọc</strong>
                <small>Xem môn học, độ khó, đoạn khớp và lý do phù hợp trước khi mở tài liệu.</small>
              </p>
            </li>
          </ol>
        </aside>
      </section>

      <section className="dashboard-grid analytics-grid">
        <div className="content-section chart-card">
          <div className="section-heading">
            <div>
              <h2>Môn học phổ biến</h2>
              <p>Các môn có nhiều tài liệu nhất.</p>
            </div>
          </div>
          <div className="bar-list">
            {topicRows.length ? (
              topicRows.map((row) => (
                <div className="bar-row" key={row.primaryTopic ?? "unknown"}>
                  <span>{row.primaryTopic ?? "Chưa rõ"}</span>
                  <div>
                    <i style={{ width: `${Math.max(8, (row._count._all / maxTopicCount) * 100)}%` }} />
                  </div>
                  <strong>{row._count._all}</strong>
                </div>
              ))
            ) : (
              <p className="chart-empty">Chưa có tài liệu đã phân tích.</p>
            )}
          </div>
        </div>
        <div className="content-section chart-card">
          <div className="section-heading">
            <div>
              <h2>Độ khó & trạng thái</h2>
              <p>Theo dõi nhanh tình trạng xử lý tài liệu.</p>
            </div>
          </div>
          <div className="bar-list compact-bars">
            {difficultyRows.length ? (
              difficultyRows.map((row) => (
                <div className="bar-row" key={row.difficulty ?? "unknown"}>
                  <span>{formatDifficulty(row.difficulty)}</span>
                  <div>
                    <i style={{ width: `${Math.max(8, (row._count._all / maxDifficultyCount) * 100)}%` }} />
                  </div>
                  <strong>{row._count._all}</strong>
                </div>
              ))
            ) : (
              <p className="chart-empty">Chưa có nhãn độ khó.</p>
            )}
            {visibleStatusRows.length ? (
              <div className="status-summary">
                {visibleStatusRows.map((row) => (
                <span key={row.status}>
                  <i className={`status-dot ${row.status.toLowerCase()}`} />
                  {statusLabels[row.status] ?? row.status}: {row._count._all}
                </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
