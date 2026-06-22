import { FolderKanban, Plus } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";

export default function ProjectsPage() {
  return <div className="page-wrap"><header className="page-header"><div><p className="eyebrow">Research workspace</p><h1>Projects</h1><p>Tổ chức đề tài và nhận gợi ý tài liệu phù hợp.</p></div><button className="primary-button compact" disabled><Plus size={18} />Project mới</button></header><section className="content-section"><EmptyState icon={FolderKanban} title="Chưa có Research Project" description="Tạo project, mô tả mục tiêu nghiên cứu và hệ thống sẽ xây dựng danh sách đọc liên quan." /></section></div>;
}
