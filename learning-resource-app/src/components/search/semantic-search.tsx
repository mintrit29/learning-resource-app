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

type SearchMode = "SEARCH" | "ASK";
type SearchStatus = "OK" | "NO_RELEVANT_RESULTS" | "EMPTY_LIBRARY";

type SavedSearchState = {
  mode?: SearchMode;
  query: string;
  results: SearchResult[];
  evidenceAnswer?: EvidenceAnswer | null;
  status?: SearchStatus;
};

const examples: Record<SearchMode, string[]> = {
  SEARCH: ["database", "slide machine learning nâng cao", "tài liệu về cấu trúc dữ liệu"],
  ASK: [
    "Database transaction rollback hoạt động thế nào?",
    "Stack và queue khác nhau như thế nào?",
    "Làm sao đánh giá nguồn học thuật đáng tin cậy?",
  ],
};

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
  const [mode, setMode] = useState<SearchMode>("SEARCH");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [error, setError] = useState("");
  const [evidenceAnswer, setEvidenceAnswer] = useState<EvidenceAnswer | null>(null);
  const [answerError, setAnswerError] = useState("");
  const [searchStatus, setSearchStatus] = useState<SearchStatus | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const savedSearch = readSavedSearch();
      if (!savedSearch) return;
      setMode(savedSearch.mode ?? (savedSearch.evidenceAnswer ? "ASK" : "SEARCH"));
      setQuery(savedSearch.query);
      setSearchedQuery(savedSearch.query);
      setResults(savedSearch.results ?? []);
      setEvidenceAnswer(savedSearch.evidenceAnswer ?? null);
      setSearchStatus(savedSearch.status ?? (savedSearch.results?.length ? "OK" : null));
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, []);

  async function runSearch(normalizedQuery: string): Promise<SearchResult[] | null> {
    if (normalizedQuery.length < 2) return null;

    setIsSearching(true);
    setError("");
    setAnswerError("");
    setEvidenceAnswer(null);
    setSearchStatus(null);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: normalizedQuery,
          mode,
          chunksPerDocument: 2,
        }),
      });
      const data = (await response.json()) as {
        message?: string;
        status?: SearchStatus;
        results?: SearchResult[];
      };
      if (!response.ok) {
        setError(data.message ?? "Không thể tìm trong tài liệu.");
        setResults([]);
        return null;
      }
      const nextResults = data.results ?? [];
      setResults(nextResults);
      setSearchStatus(data.status ?? (nextResults.length ? "OK" : "NO_RELEVANT_RESULTS"));
      setSearchedQuery(normalizedQuery);
      sessionStorage.setItem("scholarflow:last-search", JSON.stringify({
        mode,
        query: normalizedQuery,
        results: nextResults,
        evidenceAnswer: null,
        status: data.status,
      } satisfies SavedSearchState));
      return nextResults;
    } catch {
      setError("Không thể kết nối tới máy chủ.");
      setResults([]);
      return null;
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = query.trim();
    const nextResults = await runSearch(normalizedQuery);
    if (mode === "ASK" && nextResults?.length) {
      await answerFromResults(normalizedQuery, nextResults);
    }
  }

  function handleModeChange(nextMode: SearchMode) {
    if (nextMode === mode) return;
    setMode(nextMode);
    setResults([]);
    setSearchedQuery("");
    setEvidenceAnswer(null);
    setError("");
    setAnswerError("");
    setSearchStatus(null);
    sessionStorage.removeItem("scholarflow:last-search");
  }

  function handleClearSearch() {
    setResults([]);
    setSearchedQuery("");
    setEvidenceAnswer(null);
    setError("");
    setAnswerError("");
    setSearchStatus(null);
    sessionStorage.removeItem("scholarflow:last-search");
  }

  async function answerFromResults(answerQuery: string, answerResults: SearchResult[]) {
    setIsAnswering(true);
    setAnswerError("");
    setEvidenceAnswer(null);
    try {
      const response = await fetch("/api/search/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: answerQuery,
          chunkIds: answerResults.slice(0, 8).map((result) => result.chunkId),
        }),
      });
      const data = (await response.json()) as EvidenceAnswer & { message?: string };
      if (!response.ok) {
        setAnswerError(data.message ?? "AI chưa tạo được câu trả lời.");
        return;
      }
      setEvidenceAnswer(data);
      sessionStorage.setItem("scholarflow:last-search", JSON.stringify({
        mode: "ASK",
        query: answerQuery,
        results: answerResults,
        evidenceAnswer: data,
        status: "OK",
      } satisfies SavedSearchState));
    } catch {
      setAnswerError("Không thể kết nối tới AI để tạo câu trả lời.");
    } finally {
      setIsAnswering(false);
    }
  }

  const uniqueResults = results.filter(
    (result, index) => results.findIndex((item) => item.documentId === result.documentId) === index,
  );
  const citedDocumentIds = new Set(evidenceAnswer?.citations.map((citation) => citation.documentId) ?? []);
  const displayResults = mode === "ASK" && evidenceAnswer && citedDocumentIds.size
    ? uniqueResults.filter((result) => citedDocumentIds.has(result.documentId))
    : uniqueResults;
  const isBusy = isSearching || isAnswering;

  return (
    <div>
      <div aria-label="Chế độ tìm kiếm" className="search-mode-switch" role="tablist">
        <button
          aria-selected={mode === "SEARCH"}
          className={mode === "SEARCH" ? "active" : ""}
          onClick={() => handleModeChange("SEARCH")}
          role="tab"
          type="button"
        >
          <Search size={17} />
          <span>
            <strong>Tìm tài liệu</strong>
            <small>Tìm theo từ khóa hoặc chủ đề</small>
          </span>
        </button>
        <button
          aria-selected={mode === "ASK"}
          className={mode === "ASK" ? "active" : ""}
          onClick={() => handleModeChange("ASK")}
          role="tab"
          type="button"
        >
          <MessageSquareQuote size={17} />
          <span>
            <strong>Hỏi tài liệu</strong>
            <small>Nhận câu trả lời kèm nguồn</small>
          </span>
        </button>
      </div>

      <form className="search-bar active-search question-search" onSubmit={handleSubmit}>
        {mode === "SEARCH" ? <Search size={20} /> : <MessageSquareQuote size={20} />}
        <input
          aria-label={mode === "SEARCH" ? "Tìm tài liệu" : "Hỏi tài liệu"}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={mode === "SEARCH" ? "Nhập chủ đề, từ khóa hoặc loại tài liệu..." : "Đặt một câu hỏi cụ thể từ tài liệu của bạn..."}
          value={query}
        />
        <button disabled={isBusy || query.trim().length < 2} type="submit">
          {isBusy ? <LoaderCircle className="spin" size={17} /> : null}
          {isSearching ? "Đang tìm" : isAnswering ? "Đang trả lời" : mode === "SEARCH" ? "Tìm tài liệu" : "Hỏi tài liệu"}
        </button>
      </form>

      {!searchedQuery && (
        <div className="query-examples">
          <span>{mode === "SEARCH" ? "Thử tìm:" : "Thử hỏi:"}</span>
          {examples[mode].map((example) => (
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
          <h2>{searchStatus === "EMPTY_LIBRARY" ? "Thư viện chưa có tài liệu" : "Không tìm thấy đoạn phù hợp"}</h2>
          <p>
            {searchStatus === "EMPTY_LIBRARY"
              ? "Hãy thêm tài liệu trước để ScholarFlow có dữ liệu tìm kiếm và trả lời."
              : mode === "SEARCH"
              ? "Thư viện chưa có tài liệu đủ liên quan. Thử từ khóa khác hoặc thêm tài liệu mới."
              : "Chưa có đoạn nào đủ liên quan để trả lời chắc chắn. Hãy hỏi cụ thể hơn hoặc thêm tài liệu phù hợp."}
          </p>
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
