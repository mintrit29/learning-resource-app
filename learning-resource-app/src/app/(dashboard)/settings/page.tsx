import Link from "next/link";
import { Bot, ChevronRight, Tags } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="page-wrap narrow">
      <header className="page-header">
        <div>
          <p className="eyebrow">Cài đặt</p>
          <h1>Thiết lập hệ thống</h1>
          <p>Kết nối AI và quản lý cách ScholarFlow gom chủ đề trong tài liệu.</p>
        </div>
      </header>
      <div className="settings-list">
        <Link href="/settings/ai-providers">
          <span>
            <Bot size={21} />
          </span>
          <div>
            <strong>Kết nối AI</strong>
            <p>Thêm OpenRouter, Ollama hoặc Custom API để phân tích tài liệu.</p>
          </div>
          <ChevronRight size={18} />
        </Link>
        <Link href="/settings/tags">
          <span>
            <Tags size={21} />
          </span>
          <div>
            <strong>Chủ đề chuẩn & tên gọi khác</strong>
            <p>Gom “Học máy”, “Machine Learning”, “ML”… về cùng một chủ đề.</p>
          </div>
          <ChevronRight size={18} />
        </Link>
      </div>
    </div>
  );
}
