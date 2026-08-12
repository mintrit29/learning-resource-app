import { BookOpenText } from "lucide-react";
import { LocalComponentsManager } from "@/components/settings/local-components-manager";

export default function ComponentSetupPage() {
  return (
    <main className="setup-page">
      <header className="setup-heading">
        <span><BookOpenText size={25} /></span>
        <div><p className="eyebrow">Thiết lập lần đầu</p><h1>Chuẩn bị ScholarFlow trên máy này</h1></div>
      </header>
      <p className="setup-description">Hai thành phần chạy hoàn toàn trên máy của bạn. Có thể để sau; app vẫn mở nhưng chức năng đọc tài liệu và tìm kiếm ngữ nghĩa sẽ bị giới hạn.</p>
      <LocalComponentsManager onboarding />
    </main>
  );
}
