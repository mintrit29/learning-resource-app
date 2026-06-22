import { Tags } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";

export default function TagsPage() {
  return <div className="page-wrap"><header className="page-header"><div><p className="eyebrow">Taxonomy</p><h1>Chủ đề và tags</h1><p>Chuẩn hóa các tên chủ đề do AI tạo ra.</p></div></header><section className="content-section"><EmptyState icon={Tags} title="Chưa có canonical tag" description="Tags sẽ được tạo sau khi AI phân tích tài liệu đầu tiên." /></section></div>;
}
