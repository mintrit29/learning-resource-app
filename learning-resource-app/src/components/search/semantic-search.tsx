"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowUpRight, FileSearch, LoaderCircle, Search } from "lucide-react";

type SearchResult = {
  chunkId: string;
  documentId: string;
  title: string;
  fileType: string;
  primaryTopic: string | null;
  difficulty: string | null;
  content: string;
  pageNumber: number | null;
  sourceLabel: string | null;
  score: number;
};

export function SemanticSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [error, setError] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) return;

    setIsSearching(true);
    setError("");
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: normalizedQuery, limit: 10 }),
      });
      const data = (await response.json()) as {
        message?: string;
        results?: SearchResult[];
      };
      if (!response.ok) {
        setError(data.message ?? "Không thể tìm kiếm");
        setResults([]);
        return;
      }
      setResults(data.results ?? []);
      setSearchedQuery(normalizedQuery);
    } catch {
      setError("Không thể kết nối tới máy chủ");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div>
      <form className="search-bar active-search" onSubmit={handleSubmit}>
        <Search size={20} />
        <input
          aria-label="Tìm kiếm tài liệu"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ví dụ: tài liệu giải thích decision tree cho người mới..."
          value={query}
        />
        <button disabled={isSearching || query.trim().length < 2} type="submit">
          {isSearching ? <LoaderCircle className="spin" size={17} /> : null}
          {isSearching ? "Đang tìm" : "Tìm kiếm"}
        </button>
      </form>
      {error ? <div className="search-error"><strong>Không thể tìm kiếm</strong><p>{error}</p></div> : null}
      {!error && searchedQuery && results.length === 0 ? (
        <div className="empty-state search-empty"><div className="empty-icon"><FileSearch size={24} /></div><h2>Không tìm thấy tài liệu phù hợp</h2><p>Thử mô tả bằng từ khác hoặc tải thêm tài liệu vào thư viện.</p></div>
      ) : null}
      {results.length ? (
        <section className="search-results">
          <div className="search-results-heading"><h2>Kết quả cho “{searchedQuery}”</h2><span>{results.length} tài liệu</span></div>
          {results.map((result) => (
            <Link href={`/documents/${result.documentId}?chunk=${result.chunkId}#matched-chunk`} key={result.chunkId}>
              <div className="result-main">
                <div className="result-title"><span>{result.fileType}</span><h3>{result.title}</h3></div>
                <p>{result.content.slice(0, 360)}{result.content.length > 360 ? "..." : ""}</p>
                <div className="result-tags">
                  {result.sourceLabel ? <span className="source-tag">{result.sourceLabel}</span> : null}
                  {result.primaryTopic ? <span>{result.primaryTopic}</span> : null}
                  {result.difficulty ? <span>{result.difficulty}</span> : null}
                </div>
              </div>
              <div className="result-score"><strong>{Math.round(result.score * 100)}%</strong><small>Độ tương đồng</small><ArrowUpRight size={17} /></div>
            </Link>
          ))}
        </section>
      ) : null}
    </div>
  );
}
