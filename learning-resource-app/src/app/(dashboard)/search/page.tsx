import { SemanticSearch } from "@/components/search/semantic-search";

export default function SearchPage() {
  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Tìm kiếm thông minh</p>
          <h1>Tìm kiếm tài liệu</h1>
          <p>
            Keyword và vector được kết hợp trong cùng một lần tìm. Nếu bạn nhập câu hỏi, ScholarFlow sẽ trả lời kèm nguồn.
          </p>
        </div>
      </header>
      <SemanticSearch />
    </div>
  );
}
