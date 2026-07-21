import { SemanticSearch } from "@/components/search/semantic-search";

export default function SearchPage() {
  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Tìm kiếm thông minh</p>
          <h1>Tìm kiếm tài liệu</h1>
          <p>
            ScholarFlow tìm theo ý nghĩa và dùng từ khóa để xếp hạng chính xác hơn. Bạn có thể gọi AI trả lời từ kết quả khi cần.
          </p>
        </div>
      </header>
      <SemanticSearch />
    </div>
  );
}
