import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  FileStack,
  FolderKanban,
  MessageCircleQuestion,
  ServerCog,
  Sparkles,
  Upload,
} from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const statusLabels: Record<string, string> = {
  UPLOADED: "Đã tải lên",
  EXTRACTING: "Đang đọc file",
  EXTRACTED: "Đã đọc nội dung",
  ANALYZING: "Đang phân tích",
  READY: "Sẵn sàng",
  FAILED: "Bị lỗi",
};

function getRecentDocumentHint(status: string, originalFileName: string) {
  if (status === "READY" || status === "EXTRACTED") return originalFileName;
  return statusLabels[status] ?? status;
}

function getProviderStatus(provider: { displayName: string; type: string; authStatus: string } | null) {
  if (!provider) {
    return {
      isConnected: false,
      value: "Chưa có",
      detail: "Cần kết nối để phân tích",
      stepHint: "Thêm OpenRouter, Ollama hoặc Custom API.",
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
  const session = await auth();
  const userId = session!.user.id;
  const [
    documentCount,
    readyCount,
    projectCount,
    recentDocuments,
    topicRows,
    difficultyRows,
    statusRows,
    activeProvider,
  ] = await Promise.all([
    db.document.count({ where: { userId } }),
    db.document.count({ where: { userId, status: { in: ["EXTRACTED", "READY"] } } }),
    db.project.count({ where: { userId } }),
    db.document.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, originalFileName: true, fileType: true, status: true, createdAt: true },
    }),
    db.document.groupBy({
      by: ["primaryTopic"],
      where: { userId, primaryTopic: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { primaryTopic: "desc" } },
      take: 6,
    }),
    db.document.groupBy({
      by: ["difficulty"],
      where: { userId, difficulty: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { difficulty: "desc" } },
    }),
    db.document.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
      orderBy: { _count: { status: "desc" } },
    }),
    db.aiProvider.findFirst({
      where: { userId, isActive: true },
      select: { displayName: true, type: true, authStatus: true },
    }),
  ]);

  const maxTopicCount = Math.max(1, ...topicRows.map((row) => row._count._all));
  const maxDifficultyCount = Math.max(1, ...difficultyRows.map((row) => row._count._all));
  const readyRate = documentCount ? Math.round((readyCount / documentCount) * 100) : 0;
  const visibleStatusRows = statusRows.filter((row) => row.status !== "READY" && row.status !== "EXTRACTED");
  const providerStatus = getProviderStatus(activeProvider);

  const nextAction = !providerStatus.isConnected
    ? {
        href: "/settings/ai-providers",
        label: activeProvider ? "Kiểm tra kết nối AI" : "Kết nối AI",
        helper: activeProvider
          ? "Provider mặc định chưa kết nối ổn. Hãy test lại hoặc sửa cấu hình."
          : "Cần provider để app tóm tắt, phân loại và gợi ý tài liệu.",
        icon: ServerCog,
      }
    : documentCount === 0
      ? {
          href: "/upload",
          label: "Thêm tài liệu đầu tiên",
          helper: "Tải PDF, DOCX, PPTX hoặc EPUB để bắt đầu xây thư viện.",
          icon: Upload,
        }
      : {
          href: "/search",
          label: "Hỏi tài liệu",
          helper: "Thử hỏi: “tài liệu nào giải thích SQL cho người mới?”",
          icon: MessageCircleQuestion,
        };

  const NextIcon = nextAction.icon;
  const metrics = [
    {
      label: "Tài liệu",
      value: documentCount,
      detail: documentCount ? "Đang có trong thư viện" : "Chưa có tài liệu",
      icon: FileStack,
    },
    {
      label: "Sẵn sàng để hỏi",
      value: `${readyRate}%`,
      detail: `${readyCount}/${documentCount} tài liệu đã xử lý`,
      icon: Sparkles,
    },
    {
      label: "Đề tài",
      value: projectCount,
      detail: projectCount ? "Đề tài đang theo dõi" : "Chưa có đề tài",
      icon: FolderKanban,
    },
    {
      label: "Kết nối AI",
      value: providerStatus.value,
      detail: providerStatus.detail,
      icon: ServerCog,
    },
  ];

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Tổng quan</p>
          <h1>Hôm nay bạn muốn làm gì với tài liệu?</h1>
          <p>
            ScholarFlow giúp bạn thêm tài liệu, tự phân tích nội dung và tìm lại kiến thức
            bằng câu hỏi tự nhiên.
          </p>
        </div>
        <Link className="primary-button compact" href={nextAction.href}>
          <NextIcon size={18} />
          {nextAction.label}
        </Link>
      </header>

      <section className="onboarding-card">
        <div>
          <p className="eyebrow">Bắt đầu nhanh</p>
          <h2>{nextAction.label}</h2>
          <p>{nextAction.helper}</p>
        </div>
        <ol className="onboarding-steps">
          <li className={providerStatus.isConnected ? "done" : "current"}>
            <span>{providerStatus.isConnected ? <CheckCircle2 size={17} /> : "1"}</span>
            <div>
              <strong>Kết nối AI</strong>
              <small>{providerStatus.stepHint}</small>
            </div>
            {!providerStatus.isConnected ? <Link href="/settings/ai-providers">{activeProvider ? "Kiểm tra" : "Làm ngay"}</Link> : null}
          </li>
          <li className={documentCount > 0 ? "done" : providerStatus.isConnected ? "current" : ""}>
            <span>{documentCount > 0 ? <CheckCircle2 size={17} /> : "2"}</span>
            <div>
              <strong>Thêm tài liệu</strong>
              <small>{documentCount > 0 ? `${documentCount} tài liệu trong thư viện` : "PDF, PPTX, DOCX hoặc EPUB."}</small>
            </div>
            {documentCount === 0 ? <Link href="/upload">Thêm file</Link> : null}
          </li>
          <li className={documentCount > 0 ? "current" : ""}>
            <span>3</span>
            <div>
              <strong>Hỏi tài liệu</strong>
              <small>Tìm đoạn liên quan bằng câu hỏi tự nhiên.</small>
            </div>
            {documentCount > 0 ? <Link href="/search">Bắt đầu hỏi</Link> : null}
          </li>
        </ol>
      </section>

      <section className="metrics-grid metrics-grid-four" aria-label="Thống kê">
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
              {recentDocuments.map((document) => (
                <Link href={`/documents/${document.id}`} key={document.id}>
                  <span>{document.fileType}</span>
                  <div>
                    <strong>{document.title}</strong>
                    <small>{getRecentDocumentHint(document.status, document.originalFileName)}</small>
                  </div>
                  <time>
                    {new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(document.createdAt)}
                  </time>
                </Link>
              ))}
            </div>
          )}
        </div>
        <aside className="getting-started">
          <p className="eyebrow">Mẹo sử dụng</p>
          <h2>Không cần nhớ đúng từ khóa trong tài liệu</h2>
          <ol>
            <li>
              <span>?</span>
              <p>
                <strong>Hỏi như đang hỏi bạn học</strong>
                <small>Ví dụ: “phần nào giải thích transaction trong database?”</small>
              </p>
            </li>
            <li>
              <span>↗</span>
              <p>
                <strong>Mở đúng đoạn liên quan</strong>
                <small>Kết quả tìm kiếm sẽ dẫn tới chunk/page đã khớp.</small>
              </p>
            </li>
            <li>
              <span>AI</span>
              <p>
                <strong>Dùng đề tài để gom tài liệu</strong>
                <small>Tạo đề tài khi bạn muốn app xếp hạng tài liệu nên đọc.</small>
              </p>
            </li>
          </ol>
        </aside>
      </section>

      <section className="dashboard-grid analytics-grid">
        <div className="content-section chart-card">
          <div className="section-heading">
            <div>
              <h2>Chủ đề phổ biến</h2>
              <p>Top chủ đề AI đã phân loại.</p>
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
                  <span>{row.difficulty ?? "Chưa rõ"}</span>
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
