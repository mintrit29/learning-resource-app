import { BookOpenText } from "lucide-react";
import { ProjectFooter } from "@/components/layout/project-footer";
import { PROJECT_INFO } from "@/lib/project-info";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <div className="brand-mark"><BookOpenText size={24} /></div>
        <p className="eyebrow">{PROJECT_INFO.faculty} · Nhóm {PROJECT_INFO.group}</p>
        <h1>Tìm đúng tài liệu cho câu hỏi bạn đang nghiên cứu.</h1>
        <p>
          Phân loại học liệu, tìm kiếm theo ngữ nghĩa và gợi ý đoạn nên đọc
          phù hợp với câu hỏi của bạn.
        </p>
        <div className="auth-project-name">{PROJECT_INFO.title}</div>
      </section>
      <section className="auth-panel">
        {children}
        <ProjectFooter compact />
      </section>
    </main>
  );
}
