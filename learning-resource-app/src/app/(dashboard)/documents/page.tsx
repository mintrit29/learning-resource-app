import Link from "next/link";
import { FileStack, Upload } from "lucide-react";
import { auth } from "@/auth";
import { EmptyState } from "@/components/dashboard/empty-state";
import { db } from "@/lib/db";

const statusLabels: Record<string, string> = {
  UPLOADED: "Đã tải lên",
  EXTRACTING: "Đang trích xuất",
  EXTRACTED: "Đã trích xuất",
  ANALYZING: "Đang phân tích",
  READY: "Sẵn sàng",
  FAILED: "Thất bại",
};

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function DocumentsPage() {
  const session = await auth();
  const documents = await db.document.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      originalFileName: true,
      fileType: true,
      fileSize: true,
      status: true,
      primaryTopic: true,
      createdAt: true,
    },
  });

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div><p className="eyebrow">Library</p><h1>Tài liệu</h1><p>Quản lý toàn bộ học liệu đã tải lên.</p></div>
        <Link className="primary-button compact" href="/upload"><Upload size={18} />Tải tài liệu</Link>
      </header>
      {documents.length === 0 ? (
        <section className="content-section"><EmptyState icon={FileStack} title="Thư viện đang trống" description="Tài liệu sau khi tải lên sẽ xuất hiện ở đây cùng chủ đề, độ khó và trạng thái phân tích." actionHref="/upload" actionLabel="Tải file đầu tiên" /></section>
      ) : (
        <section className="document-table-wrap">
          <div className="document-table-header"><span>Tài liệu</span><span>Loại</span><span>Trạng thái</span><span>Ngày thêm</span></div>
          <div className="document-rows">
            {documents.map((document) => (
              <Link className="document-row" href={`/documents/${document.id}`} key={document.id}>
                <div className="document-name"><span>{document.fileType}</span><div><strong>{document.title}</strong><small>{formatBytes(document.fileSize)} · {document.originalFileName}</small></div></div>
                <span>{document.fileType}</span>
                <span><i className={`status-dot ${document.status.toLowerCase()}`} />{statusLabels[document.status]}</span>
                <span>{new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(document.createdAt)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
