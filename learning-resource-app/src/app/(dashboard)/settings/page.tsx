import Link from "next/link";
import { Bot, ChevronRight, HardDrive, Tags } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="page-wrap narrow">
      <header className="page-header">
        <div>
          <p className="eyebrow">Cài đặt</p>
          <h1>Thiết lập hệ thống</h1>
          <p>Kết nối AI và quản lý danh sách môn học dùng để phân loại tài liệu.</p>
        </div>
      </header>
      <div className="settings-list">
        <Link href="/settings/components">
          <span><HardDrive size={21} /></span>
          <div><strong>Thành phần cục bộ</strong><p>Tải và quản lý Docling, BGE-M3 cùng Whisper trên máy.</p></div>
          <ChevronRight size={18} />
        </Link>
        <Link href="/settings/ai-providers">
          <span>
            <Bot size={21} />
          </span>
          <div>
            <strong>Kết nối AI</strong>
            <p>Dùng Qwen cục bộ hoặc kết nối OpenRouter và Custom API.</p>
          </div>
          <ChevronRight size={18} />
        </Link>
        <Link href="/settings/tags">
          <span>
            <Tags size={21} />
          </span>
          <div>
            <strong>Danh sách môn học</strong>
            <p>Quản lý các môn mà AI được phép dùng khi phân loại tài liệu.</p>
          </div>
          <ChevronRight size={18} />
        </Link>
      </div>
    </div>
  );
}
