import { SemanticSearch } from "@/components/search/semantic-search";

export default function SearchPage() {
  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Hỏi tài liệu</p>
          <h1>Bạn muốn tìm gì?</h1>
          <p>
            Gõ câu hỏi bằng ngôn ngữ tự nhiên. ScholarFlow sẽ tìm các đoạn liên quan
            nhất trong thư viện của bạn.
          </p>
        </div>
      </header>
      <SemanticSearch />
    </div>
  );
}
