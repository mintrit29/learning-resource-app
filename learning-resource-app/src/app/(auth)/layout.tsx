import { BookOpenText } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <div className="brand-mark"><BookOpenText size={24} /></div>
        <p className="eyebrow">Smart Learning Resources</p>
        <h1>Tìm đúng tài liệu cho câu hỏi bạn đang nghiên cứu.</h1>
        <p>
          Phân loại học liệu, tìm kiếm theo ngữ nghĩa và xây dựng danh sách đọc
          phù hợp cho từng Research Project.
        </p>
      </section>
      <section className="auth-panel">{children}</section>
    </main>
  );
}
