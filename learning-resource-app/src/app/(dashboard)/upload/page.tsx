import { UploadForm } from "@/components/documents/upload-form";

export default function UploadPage() {
  return (
    <div className="page-wrap narrow">
      <header className="page-header">
        <div>
          <p className="eyebrow">Document intake</p>
          <h1>Tải tài liệu</h1>
          <p>Thêm học liệu mới và trích xuất nội dung để chuẩn bị phân tích.</p>
        </div>
      </header>
      <UploadForm />
      <p className="foundation-note">
        File gốc và toàn bộ text được lưu riêng. Embedding và phân tích AI sẽ được nối ở bước tiếp theo.
      </p>
    </div>
  );
}
