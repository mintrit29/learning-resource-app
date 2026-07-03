"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowUpRight, FileSearch, LoaderCircle, Search, SlidersHorizontal, Sparkles } from "lucide-react";

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

type SearchDocument = {
  id: string;
  title: string;
  fileType: string;
};

type CuratedSearchItem = {
  chunkId: string;
  group: "READ_FIRST" | "READ_LATER" | "SKIP";
  reason: string;
};

type CuratedSearch = {
  summary: string;
  items: CuratedSearchItem[];
};

const examples = [
  "Tài liệu nào giải thích SQL cho người mới?",
  "Tìm phần nói về transaction trong database",
  "Có tài liệu nào liên quan đến machine learning không?",
];

export function SemanticSearch({ documents }: { documents: SearchDocument[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [fileType, setFileType] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState("");
  const [curationError, setCurationError] = useState("");
  const [curatedSearch, setCuratedSearch] = useState<CuratedSearch | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isCurating, setIsCurating] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) return;

    setIsSearching(true);
    setError("");
    setCurationError("");
    setCuratedSearch(null);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: normalizedQuery,
          limit: 10,
          topic: topic.trim() || undefined,
          difficulty: difficulty || undefined,
          fileType: fileType || undefined,
          documentId: documentId || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        }),
      });
      const data = (await response.json()) as {
        message?: string;
        results?: SearchResult[];
      };
      if (!response.ok) {
        setError(data.message ?? "Không thể tìm trong tài liệu.");
        setResults([]);
        return;
      }
      setResults(data.results ?? []);
      setSearchedQuery(normalizedQuery);
    } catch {
      setError("Không thể kết nối tới máy chủ.");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  async function handleCurateResults() {
    if (!searchedQuery || !results.length) return;

    setIsCurating(true);
    setCurationError("");
    try {
      const response = await fetch("/api/search/curate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchedQuery,
          results: results.slice(0, 10),
        }),
      });
      const data = (await response.json()) as {
        message?: string;
        summary?: string;
        items?: CuratedSearchItem[];
      };
      if (!response.ok) {
        setCurationError(data.message ?? "AI chưa lọc được kết quả.");
        return;
      }
      setCuratedSearch({
        summary: data.summary ?? "AI đã đọc nhanh các kết quả và chia nhóm bên dưới.",
        items: data.items ?? [],
      });
    } catch {
      setCurationError("Không thể kết nối tới AI để lọc kết quả.");
    } finally {
      setIsCurating(false);
    }
  }

  const resultsById = new Map(results.map((result) => [result.chunkId, result]));
  const curatedGroups = {
    READ_FIRST: curatedSearch?.items
      .filter((item) => item.group === "READ_FIRST")
      .map((item) => ({ item, result: resultsById.get(item.chunkId) }))
      .filter((entry): entry is { item: CuratedSearchItem; result: SearchResult } => Boolean(entry.result)) ?? [],
    READ_LATER: curatedSearch?.items
      .filter((item) => item.group === "READ_LATER")
      .map((item) => ({ item, result: resultsById.get(item.chunkId) }))
      .filter((entry): entry is { item: CuratedSearchItem; result: SearchResult } => Boolean(entry.result)) ?? [],
    SKIP: curatedSearch?.items
      .filter((item) => item.group === "SKIP")
      .map((item) => ({ item, result: resultsById.get(item.chunkId) }))
      .filter((entry): entry is { item: CuratedSearchItem; result: SearchResult } => Boolean(entry.result)) ?? [],
  };

  return (
    <div>
      <form className="search-bar active-search question-search" onSubmit={handleSubmit}>
        <Search size={20} />
        <input
          aria-label="Hỏi tài liệu"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ví dụ: phần nào giải thích database transaction?"
          value={query}
        />
        <button disabled={isSearching || query.trim().length < 2} type="submit">
          {isSearching ? <LoaderCircle className="spin" size={17} /> : null}
          {isSearching ? "Đang tìm" : "Hỏi tài liệu"}
        </button>
      </form>

      {!searchedQuery && (
        <div className="query-examples">
          <span>Thử hỏi:</span>
          {examples.map((example) => (
            <button key={example} onClick={() => setQuery(example)} type="button">
              {example}
            </button>
          ))}
        </div>
      )}

      <button className="advanced-toggle" onClick={() => setShowFilters((value) => !value)} type="button">
        <SlidersHorizontal size={16} />
        {showFilters ? "Ẩn bộ lọc nâng cao" : "Hiện bộ lọc nâng cao"}
      </button>

      {showFilters ? (
        <div className="search-filters">
          <label>
            <span>Tài liệu</span>
            <select onChange={(event) => setDocumentId(event.target.value)} value={documentId}>
              <option value="">Tất cả tài liệu</option>
              {documents.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.title} ({document.fileType})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Chủ đề</span>
            <input onChange={(event) => setTopic(event.target.value)} placeholder="VD: Database, AI..." value={topic} />
          </label>
          <label>
            <span>Độ khó</span>
            <select onChange={(event) => setDifficulty(event.target.value)} value={difficulty}>
              <option value="">Tất cả</option>
              <option value="BEGINNER">Cơ bản</option>
              <option value="INTERMEDIATE">Trung cấp</option>
              <option value="ADVANCED">Nâng cao</option>
            </select>
          </label>
          <label>
            <span>Loại file</span>
            <select onChange={(event) => setFileType(event.target.value)} value={fileType}>
              <option value="">Tất cả</option>
              <option value="PDF">PDF</option>
              <option value="PPTX">PPTX</option>
              <option value="DOCX">DOCX</option>
              <option value="EPUB">EPUB</option>
            </select>
          </label>
          <label>
            <span>Từ ngày</span>
            <input onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} />
          </label>
          <label>
            <span>Đến ngày</span>
            <input onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} />
          </label>
        </div>
      ) : null}

      {error ? (
        <div className="search-error">
          <strong>Chưa tìm được</strong>
          <p>{error}</p>
        </div>
      ) : null}
      {!error && searchedQuery && results.length === 0 ? (
        <div className="empty-state search-empty">
          <div className="empty-icon">
            <FileSearch size={24} />
          </div>
          <h2>Không tìm thấy đoạn phù hợp</h2>
          <p>Thử hỏi ngắn hơn, dùng từ khác, hoặc thêm nhiều tài liệu hơn vào thư viện.</p>
        </div>
      ) : null}
      {results.length ? (
        <section className="search-results">
          <div className="search-results-heading">
            <h2>Kết quả cho “{searchedQuery}”</h2>
            <span>{results.length} đoạn phù hợp</span>
          </div>
          <div className="ai-curation-toolbar">
            <div>
              <strong>Không chắc nên đọc đoạn nào?</strong>
              <p>Để AI đọc nhanh kết quả và chia nhóm ưu tiên cho bạn.</p>
            </div>
            <button className="ai-curate-button" disabled={isCurating} onClick={handleCurateResults} type="button">
              {isCurating ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
              {isCurating ? "AI đang đọc" : "AI chọn giúp"}
            </button>
          </div>
          {curationError ? (
            <div className="ai-curation-error">
              <strong>AI chọn kết quả chưa được</strong>
              <p>{curationError}</p>
            </div>
          ) : null}
          {curatedSearch ? (
            <div className="ai-curation-panel">
              <div className="ai-curation-intro">
                <Sparkles size={18} />
                <div>
                  <strong>Gợi ý nên đọc</strong>
                  <p>{curatedSearch.summary}</p>
                </div>
              </div>
              {[
                ["READ_FIRST", "Nên đọc trước", curatedGroups.READ_FIRST],
                ["READ_LATER", "Đọc thêm nếu cần", curatedGroups.READ_LATER],
                ["SKIP", "Có thể bỏ qua", curatedGroups.SKIP],
              ].map(([key, label, entries]) => (
                <div className="ai-curation-group" key={key as string}>
                  <h3>{label as string}</h3>
                  {(entries as Array<{ item: CuratedSearchItem; result: SearchResult }>).length ? (
                    <div className="ai-curation-items">
                      {(entries as Array<{ item: CuratedSearchItem; result: SearchResult }>).map(({ item, result }) => (
                        <Link
                          href={`/documents/${result.documentId}?chunk=${result.chunkId}#matched-chunk`}
                          key={item.chunkId}
                        >
                          <span>{result.fileType}</span>
                          <div>
                            <strong>{result.title}</strong>
                            <p>{item.reason}</p>
                            <small>
                              {result.sourceLabel ? `${result.sourceLabel} · ` : ""}
                              {Math.round(result.score * 100)}% khớp
                            </small>
                          </div>
                          <ArrowUpRight size={15} />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="ai-curation-empty">Không có kết quả trong nhóm này.</p>
                  )}
                </div>
              ))}
            </div>
          ) : null}
          {results.map((result) => (
            <Link href={`/documents/${result.documentId}?chunk=${result.chunkId}#matched-chunk`} key={result.chunkId}>
              <div className="result-main">
                <div className="result-title">
                  <span>{result.fileType}</span>
                  <h3>{result.title}</h3>
                </div>
                <p>
                  {result.content.slice(0, 360)}
                  {result.content.length > 360 ? "..." : ""}
                </p>
                <div className="result-tags">
                  {result.sourceLabel ? <span className="source-tag">{result.sourceLabel}</span> : null}
                  {result.primaryTopic ? <span>{result.primaryTopic}</span> : null}
                  {result.difficulty ? <span>{result.difficulty}</span> : null}
                </div>
                <small className="result-citation">
                  Nguồn: {result.title}
                  {result.sourceLabel ? ` · ${result.sourceLabel}` : ""}
                </small>
              </div>
              <div className="result-score">
                <strong>{Math.round(result.score * 100)}%</strong>
                <small>Mức khớp</small>
                <span>Mở đúng đoạn</span>
                <ArrowUpRight size={17} />
              </div>
            </Link>
          ))}
        </section>
      ) : null}
    </div>
  );
}
