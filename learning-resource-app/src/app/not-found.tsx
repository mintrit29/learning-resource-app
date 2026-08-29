import Link from "next/link";

export default function NotFound() {
  return <section className="page-shell">
    <p className="eyebrow">Không tìm thấy nội dung</p>
    <h1>Trang hoặc tài liệu không còn tồn tại</h1>
    <p>Tài liệu có thể đã bị xóa hoặc đường dẫn không còn đúng. Bạn có thể trở về thư viện để chọn tài liệu khác.</p>
    <Link className="primary-button" href="/documents">Về thư viện tài liệu</Link>
  </section>;
}
