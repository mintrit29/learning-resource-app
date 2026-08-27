import { LocalComponentsManager } from "@/components/settings/local-components-manager";

export default function ComponentsSettingsPage() {
  return (
    <div className="page-wrap narrow">
      <header className="page-header"><div><p className="eyebrow">Cài đặt</p><h1>Thành phần cục bộ</h1><p>Tải và quản lý Docling, BGE-M3 cùng Whisper tùy chọn. Xóa model không ảnh hưởng tài liệu hoặc cơ sở dữ liệu.</p></div></header>
      <LocalComponentsManager />
    </div>
  );
}
