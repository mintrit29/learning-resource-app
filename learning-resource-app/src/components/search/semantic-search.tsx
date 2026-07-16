"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowUpRight, FileSearch, LoaderCircle, MessageSquareQuote, Search, Sparkles } from "lucide-react";
import { formatDifficulty } from "@/lib/labels";

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
  semanticScore: number | null;
  keywordScore: number | null;
  matchReasons: string[];
};

type InterpretedQuery = {
  difficulty: string | null;
  fileType: string | null;
  keywords: string[];
};

type EvidenceAnswer = {
  answer: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  notEnoughEvidence: boolean;
  citations: Array<{
    chunkId: string;
    documentId: string;
    title: string;
    fileType: string;
    quote: string;
    pageNumber: number | null;
    sourceLabel: string | null;
  }>;
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

type SavedSearchState = {
  query: string;
  results: SearchResult[];
  interpretedQuery: InterpretedQuery | null;
  retrievalMode: "hybrid" | "semantic" | "keyword";
};

const examples = [
  "Tài liệu nào giải thích SQL cho người mới?",
  "Tìm phần nói về transaction trong database",
  "Có tài liệu nào liên quan đến machine learning không?",
];

function readSavedSearch(): SavedSearchState | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.sessionStorage.getItem("scholarflow:last-search");
    return saved ? JSON.parse(saved) as SavedSearchState : null;
  } catch {
    window.sessionStorage.removeItem("scholarflow:last-search");
    return null;
  }
}

export function SemanticSearch() {
  const [savedSearch] = useState(readSavedSearch);
  const [query, setQuery] = useState(savedSearch?.query ?? "");
  const [chunksPerDocument, setChunksPerDocument] = useState(1);
  const [results, setResults] = useState<SearchResult[]>(savedSearch?.results ?? []);
  const [searchedQuery, setSearchedQuery] = useState(savedSearch?.query ?? "");
  const [error, setError] = useState("");
  const [curationError, setCurationError] = useState("");
  const [curatedSearch, setCuratedSearch] = useState<CuratedSearch | null>(null);
  const [evidenceAnswer, setEvidenceAnswer] = useState<EvidenceAnswer | null>(null);
  const [answerError, setAnswerError] = useState("");
  const [interpretedQuery, setInterpretedQuery] = useState<InterpretedQuery | null>(savedSearch?.interpretedQuery ?? null);
  const [retrievalMode, setRetrievalMode] = useState<"hybrid" | "semantic" | "keyword">(savedSearch?.retrievalMode ?? "hybrid");
  const [viewMode, setViewMode] = useState<"chunks" | "documents">("chunks");
  const [isSearching, setIsSearching] = useState(false);
  const [isCurating, setIsCurating] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);

  async function runSearch(normalizedQuery: string) {
    if (normalizedQuery.length < 2) return;

    setIsSearching(true);
    setError("");
    setCurationError("");
    setAnswerError("");
    setCuratedSearch(null);
    setEvidenceAnswer(null);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: normalizedQuery,
          chunksPerDocument,
        }),
      });
      const data = (await response.json()) as {
        message?: string;
        results?: SearchResult[];
        interpretedQuery?: InterpretedQuery;
        retrievalMode?: "hybrid" | "semantic" | "keyword";
      };
      if (!response.ok) {
        setError(data.message ?? "Không thể tìm trong tài liệu.");
        setResults([]);
        return;
      }
      setResults(data.results ?? []);
      setInterpretedQuery(data.interpretedQuery ?? null);
      setRetrievalMode(data.retrievalMode ?? "hybrid");
      setSearchedQuery(normalizedQuery);
      sessionStorage.setItem("scholarflow:last-search", JSON.stringify({
        query: normalizedQuery,
        results: data.results ?? [],
        interpretedQuery: data.interpretedQuery ?? null,
        retrievalMode: data.retrievalMode ?? "hybrid",
      } satisfies SavedSearchState));
    } catch {
      setError("Không thể kết nối tới máy chủ.");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(query.trim());
  }

  function handleClearSearch() {
    setResults([]);
    setSearchedQuery("");
    setInterpretedQuery(null);
    setCuratedSearch(null);
    setEvidenceAnswer(null);
    setError("");
    setCurationError("");
    setAnswerError("");
    sessionStorage.removeItem("scholarflow:last-search");
  }

  async function handleAnswerResults() {
    if (!searchedQuery || !results.length) return;

    setIsAnswering(true);
    setAnswerError("");
    setEvidenceAnswer(null);
    try {
      const response = await fetch("/api/search/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchedQuery,
          chunkIds: results.slice(0, 8).map((result) => result.chunkId),
        }),
      });
      const data = (await response.json()) as EvidenceAnswer & { message?: string };
      if (!response.ok) {
        setAnswerError(data.message ?? "AI chưa tạo được câu trả lời.");
        return;
      }
      setEvidenceAnswer(data);
    } catch {
      setAnswerError("Không thể kết nối tới AI để tạo câu trả lời.");
    } finally {
      setIsAnswering(false);
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
  const chunkCountByDocument = results.reduce((counts, result) => {
    counts.set(result.documentId, (counts.get(result.documentId) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const displayResults = viewMode === "chunks"
    ? results
    : results.filter((result, index) => results.findIndex((item) => item.documentId === result.documentId) === index);
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
          placeholder="Hỏi về tài liệu của bạn..."
          value={query}
        />
        <button disabled={isSearching || query.trim().length < 2} type="submit">
          {isSearching ? <LoaderCircle className="spin" size={17} /> : null}
          {isSearching ? "Đang tìm" : "Hỏi tài liệu"}
        </button>
      </form>

      <div className="search-display-options" aria-label="Tùy chỉnh kết quả tìm kiếm">
        <label>
          Mỗi tài liệu tối đa
          <select value={chunksPerDocument} onChange={(event) => setChunksPerDocument(Number(event.target.value))}>
            <option value={1}>1 đoạn</option>
            <option value={2}>2 đoạn</option>
            <option value={3}>3 đoạn</option>
            <option value={5}>5 đoạn</option>
          </select>
        </label>
        <span>Muốn xem nhiều ý trong cùng một file thì tăng số này.</span>
      </div>

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
            <div className="search-heading-actions">
              <button className="search-clear-button" onClick={handleClearSearch} type="button">
                Xóa kết quả
              </button>
              <div className="search-view-toggle" aria-label="Cách hiển thị kết quả">
              <button className={viewMode === "chunks" ? "active" : ""} onClick={() => setViewMode("chunks")} type="button">Theo đoạn</button>
              <button className={viewMode === "documents" ? "active" : ""} onClick={() => setViewMode("documents")} type="button">Theo tài liệu</button>
              </div>
            </div>
          </div>
          <p className="search-results-note">
            App đang kết hợp {retrievalMode === "hybrid" ? "ngữ nghĩa và từ khóa" : retrievalMode === "semantic" ? "ngữ nghĩa" : "từ khóa"}, rồi xếp hạng lại. Mỗi tài liệu hiển thị tối đa {chunksPerDocument} đoạn.
          </p>
          {interpretedQuery ? (
            <div className="interpreted-query" aria-label="Cách app hiểu câu hỏi">
              <strong>App hiểu:</strong>
              {interpretedQuery.fileType ? <span>{interpretedQuery.fileType}</span> : null}
              {interpretedQuery.difficulty ? <span>{formatDifficulty(interpretedQuery.difficulty)}</span> : null}
              {interpretedQuery.keywords.slice(0, 5).map((keyword) => <span key={keyword}>{keyword}</span>)}
            </div>
          ) : null}
          <div className="ai-curation-toolbar">
            <div>
              <strong>Dùng các đoạn tốt nhất làm bằng chứng</strong>
              <p>AI chỉ nhận tối đa 8 đoạn, không nhận nguyên tài liệu.</p>
            </div>
            <div className="ai-search-actions">
              <button className="ai-secondary-button" disabled={isCurating} onClick={handleCurateResults} type="button">
                {isCurating ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
                {isCurating ? "Đang lọc" : "AI chọn giúp"}
              </button>
              <button className="ai-curate-button" disabled={isAnswering} onClick={handleAnswerResults} type="button">
                {isAnswering ? <LoaderCircle className="spin" size={16} /> : <MessageSquareQuote size={16} />}
                {isAnswering ? "Đang trả lời" : "Trả lời có dẫn chứng"}
              </button>
            </div>
          </div>
          {answerError ? (
            <div className="ai-curation-error">
              <strong>Chưa tạo được câu trả lời</strong>
              <p>{answerError}</p>
            </div>
          ) : null}
          {evidenceAnswer ? (
            <div className={`evidence-answer ${evidenceAnswer.notEnoughEvidence ? "insufficient" : ""}`}>
              <div className="evidence-answer-heading">
                <MessageSquareQuote size={19} />
                <div>
                  <strong>{evidenceAnswer.notEnoughEvidence ? "Bằng chứng chưa đủ" : "Câu trả lời từ tài liệu"}</strong>
                  <span>Độ tin cậy: {evidenceAnswer.confidence === "HIGH" ? "Cao" : evidenceAnswer.confidence === "MEDIUM" ? "Trung bình" : "Thấp"}</span>
                </div>
              </div>
              <p>{evidenceAnswer.answer}</p>
              {evidenceAnswer.citations.length ? (
                <div className="evidence-citations">
                  {evidenceAnswer.citations.map((citation, index) => (
                    <Link href={`/documents/${citation.documentId}?chunk=${citation.chunkId}#matched-chunk`} key={citation.chunkId}>
                      <strong>[{index + 1}] {citation.title}</strong>
                      <span>{citation.sourceLabel ?? (citation.pageNumber ? `Trang ${citation.pageNumber}` : "Mở đoạn nguồn")}</span>
                      {citation.quote ? <q>{citation.quote}</q> : null}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
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
                        <Link href={`/documents/${result.documentId}?chunk=${result.chunkId}#matched-chunk`} key={item.chunkId}>
                          <span>{result.fileType}</span>
                          <div>
                            <strong>{result.title}</strong>
                            <p>{item.reason}</p>
                            <small>
                              {result.sourceLabel ? `${result.sourceLabel} · ` : ""}
                              Điểm xếp hạng {Math.round(result.score * 100)}/100
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
          {displayResults.map((result) => (
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
                  {result.difficulty ? <span>{formatDifficulty(result.difficulty)}</span> : null}
                  {result.matchReasons.map((reason) => <span key={reason}>{reason}</span>)}
                  {viewMode === "documents" ? <span>{chunkCountByDocument.get(result.documentId) ?? 1} đoạn phù hợp</span> : null}
                </div>
                <small className="result-citation">
                  Nguồn: {result.title}
                  {result.sourceLabel ? ` · ${result.sourceLabel}` : ""}
                </small>
              </div>
              <div className="result-score">
                <strong>{Math.round(result.score * 100)}</strong>
                <small>Điểm xếp hạng</small>
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
