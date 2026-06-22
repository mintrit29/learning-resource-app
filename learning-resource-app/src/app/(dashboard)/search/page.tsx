import { SemanticSearch } from "@/components/search/semantic-search";

export default function SearchPage() {
  return (
    <div className="page-wrap">
      <header className="page-header">
        <div><p className="eyebrow">Semantic retrieval</p><h1>Tìm kiếm</h1><p>Tìm tài liệu bằng câu hỏi hoặc mô tả tự nhiên.</p></div>
      </header>
      <SemanticSearch />
    </div>
  );
}
