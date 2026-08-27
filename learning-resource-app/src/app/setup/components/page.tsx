import { BookOpenText } from "lucide-react";
import { LocalComponentsManager } from "@/components/settings/local-components-manager";

export default function ComponentSetupPage() {
  return (
    <main className="setup-page">
      <header className="setup-heading">
        <span><BookOpenText size={25} /></span>
        <div><p className="eyebrow">Thiết lập lần đầu</p><h1>Chuẩn bị ScholarFlow trên máy này</h1></div>
      </header>
      <p className="setup-description">Docling và BGE-M3 chạy hoàn toàn trên máy của bạn. Whisper nhận dạng âm thanh là thành phần tùy chọn, có thể tải sau trong Cài đặt.</p>
      <LocalComponentsManager onboarding />
    </main>
  );
}
