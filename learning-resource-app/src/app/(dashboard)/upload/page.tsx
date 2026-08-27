import Link from "next/link";
import { UploadForm } from "@/components/documents/upload-form";

export default function UploadPage() {
  return (
    <div className="page-wrap narrow">
      <header className="page-header">
        <div>
          <p className="eyebrow">Thêm tài liệu</p>
          <h1>Đưa tài liệu vào ScholarFlow</h1>
          <p>
          Tải tài liệu, ảnh mind map hoặc file âm thanh lên. App sẽ tự chuyển thành nội dung, chia thành
            đoạn nhỏ, tạo dữ liệu tìm kiếm và phân tích bằng AI nếu bạn đã kết nối provider.
          </p>
        </div>
      </header>
      <UploadForm />
      <p className="foundation-note">
        Sau khi tải xong, bạn sẽ được đưa tới trang chi tiết để xem tiến trình xử lý.
        Nếu bước nào lỗi, có thể bấm chạy lại mà không cần xóa file.{" "}
        <Link href="/documents">Xem thư viện tài liệu</Link>
      </p>
    </div>
  );
}
