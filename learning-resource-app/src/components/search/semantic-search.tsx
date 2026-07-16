"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowUpRight, FileSearch, LoaderCircle, MessageSquareQuote, Search } from "lucide-react";
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

type SavedSearchState = {
  query: string;
  results: SearchResult[];
  evidenceAnswer?: EvidenceAnswer | null;
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
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [error, setError] = useState("");
  const [evidenceAnswer, setEvidenceAnswer] = useState<EvidenceAnswer | null>(null);
  const [answerError, setAnswerError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const savedSearch = readSavedSearch();
      if (!savedSearch) return;
      setQuery(savedSearch.query);
      setSearchedQuery(savedSearch.query);
      setResults(savedSearch.results ?? []);
      setEvidenceAnswer(savedSearch.evidenceAnswer ?? null);
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, []);

  async function runSearch(normalizedQuery: string) {
    if (normalizedQuery.length < 2) return;

    setIsSearching(true);
    setError("");
    setAnswerError("");
    setEvidenceAnswer(null);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: normalizedQuery,
          chunksPerDocument: 2,
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
      sessionStorage.setItem("scholarflow:last-search", JSON.stringify({
        query: normalizedQuery,
        results: data.results ?? [],
        evidenceAnswer: null,
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
    setEvidenceAnswer(null);
    setError("");
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
      sessionStorage.setItem("scholarflow:last-search", JSON.stringify({
        query: searchedQuery,
        results,
        evidenceAnswer: data,
      } satisfies SavedSearchState));
    } catch {
      setAnswerError("Không thể kết nối tới AI để tạo câu trả lời.");
    } finally {
      setIsAnswering(false);
    }
  }

  const displayResults = results.filter(
    (result, index) => results.findIndex((item) => item.documentId === result.documentId) === index,
  );

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
            <div>
              <h2>Kết quả cho “{searchedQuery}”</h2>
              <span>{displayResults.length} tài liệu phù hợp</span>
            </div>
            <div className="search-heading-actions">
              <button className="search-clear-button" onClick={handleClearSearch} type="button">
                Xóa kết quả
              </button>
            </div>
          </div>
          <div className="ai-curation-toolbar">
            <div>
              <strong>Cần câu trả lời nhanh?</strong>
              <p>AI sẽ trả lời từ các kết quả bên dưới và dẫn lại đúng nguồn.</p>
            </div>
            <button className="ai-curate-button" disabled={isAnswering} onClick={handleAnswerResults} type="button">
              {isAnswering ? <LoaderCircle className="spin" size={16} /> : <MessageSquareQuote size={16} />}
              {isAnswering ? "Đang trả lời" : "Trả lời từ kết quả"}
            </button>
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
                </div>
                <small className="result-citation">
                  Nguồn: {result.title}
                  {result.sourceLabel ? ` · ${result.sourceLabel}` : ""}
                </small>
              </div>
              <div className="result-open-action">
                <span>Mở đoạn liên quan</span>
                <ArrowUpRight size={17} />
              </div>
            </Link>
          ))}
        </section>
      ) : null}
    </div>
  );
}
