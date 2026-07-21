import { SemanticSearch } from "@/components/search/semantic-search";

export default function SearchPage() {
  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Tìm kiếm thông minh</p>
          <h1>Tìm và hỏi tài liệu</h1>
          <p>
            Tìm tài liệu theo chủ đề hoặc đặt câu hỏi để nhận câu trả lời kèm đúng nguồn.
          </p>
        </div>
      </header>
      <SemanticSearch />
    </div>
  );
}
