import Link from "next/link";
import { ArrowUpRight, BookOpen, FileStack, FolderKanban, Sparkles, Upload } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;
  const [documentCount, extractedCount, projectCount, recentDocuments] = await Promise.all([
    db.document.count({ where: { userId } }),
    db.document.count({ where: { userId, status: { in: ["EXTRACTED", "READY"] } } }),
    db.project.count({ where: { userId } }),
    db.document.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, title: true, fileType: true, status: true, createdAt: true } }),
  ]);

  const metrics = [
    { label: "Tổng tài liệu", value: documentCount, detail: documentCount ? "Trong thư viện" : "Chưa có tài liệu", icon: FileStack },
    { label: "Đã trích xuất", value: extractedCount, detail: "Sẵn sàng cho bước AI", icon: Sparkles },
    { label: "Research projects", value: projectCount, detail: projectCount ? "Project đang theo dõi" : "Chưa có project", icon: FolderKanban },
  ];

  return (
    <div className="page-wrap">
      <header className="page-header"><div><p className="eyebrow">Thư viện nghiên cứu</p><h1>Tổng quan</h1><p>Bắt đầu bằng một tài liệu, hệ thống sẽ lo phần còn lại.</p></div><Link className="primary-button compact" href="/upload"><Upload size={18} />Tải tài liệu</Link></header>
      <section className="metrics-grid" aria-label="Thống kê">{metrics.map((metric) => { const Icon = metric.icon; return <article className="metric" key={metric.label}><div className="metric-top"><span>{metric.label}</span><Icon size={20} /></div><strong>{metric.value}</strong><small>{metric.detail}</small></article>; })}</section>
      <section className="dashboard-grid">
        <div className="content-section recent-section"><div className="section-heading"><div><h2>Tài liệu gần đây</h2><p>Các file mới được thêm vào thư viện.</p></div><Link href="/documents">Xem tất cả <ArrowUpRight size={16} /></Link></div>
          {recentDocuments.length === 0 ? <div className="inline-empty"><BookOpen size={22} /><p>Chưa có tài liệu nào.</p><Link href="/upload">Tải file đầu tiên</Link></div> : <div className="recent-documents">{recentDocuments.map((document) => <Link href={`/documents/${document.id}`} key={document.id}><span>{document.fileType}</span><div><strong>{document.title}</strong><small>{document.status === "EXTRACTED" ? "Đã trích xuất" : document.status}</small></div><time>{new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(document.createdAt)}</time></Link>)}</div>}
        </div>
        <aside className="getting-started"><p className="eyebrow">Bắt đầu nhanh</p><h2>Biến file thành học liệu có thể tìm kiếm</h2><ol><li><span>1</span><p><strong>Tải tài liệu</strong><small>PDF, PPTX, DOCX hoặc EPUB.</small></p></li><li><span>2</span><p><strong>Đợi phân tích</strong><small>AI tạo chủ đề, độ khó và tóm tắt.</small></p></li><li><span>3</span><p><strong>Tìm theo ý nghĩa</strong><small>Dùng câu hỏi tự nhiên thay cho từ khóa cứng.</small></p></li></ol></aside>
      </section>
    </div>
  );
}
