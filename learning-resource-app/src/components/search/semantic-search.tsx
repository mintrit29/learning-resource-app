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

type SearchStatus = "OK" | "NO_RELEVANT_RESULTS" | "EMPTY_LIBRARY";

type SavedSearchState = {
  query: string;
  results: SearchResult[];
  evidenceAnswer?: EvidenceAnswer | null;
  status?: SearchStatus;
};

const SEARCH_STORAGE_KEY = "scholarflow:last-search:v2";
const LEGACY_SEARCH_STORAGE_KEY = "scholarflow:last-search";

const examples = [
  "database",
  "slide machine learning nâng cao",
  "Data inconsistency và data isolation là gì?",
];

function readSavedSearch(): SavedSearchState | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.sessionStorage.getItem(SEARCH_STORAGE_KEY);
    return saved ? JSON.parse(saved) as SavedSearchState : null;
  } catch {
    window.sessionStorage.removeItem(SEARCH_STORAGE_KEY);
    return null;
  }
}

function saveSearch(state: SavedSearchState) {
  try {
    window.sessionStorage.setItem(SEARCH_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Search still works if storage is unavailable or full.
  }
}

export function SemanticSearch() {
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
      setQuery(savedSearch.query);
      setSearchedQuery(savedSearch.query);
      setResults(savedSearch.results ?? []);
      setEvidenceAnswer(savedSearch.evidenceAnswer ?? null);
      setSearchStatus(savedSearch.status ?? (savedSearch.results?.length ? "OK" : null));
      window.sessionStorage.removeItem(LEGACY_SEARCH_STORAGE_KEY);
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
      saveSearch({
        query: normalizedQuery,
        results: nextResults,
        evidenceAnswer: null,
        status: data.status,
      });
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
    await runSearch(normalizedQuery);
  }

  function handleClearSearch() {
    setResults([]);
    setSearchedQuery("");
    setEvidenceAnswer(null);
    setError("");
    setAnswerError("");
    setSearchStatus(null);
    sessionStorage.removeItem(SEARCH_STORAGE_KEY);
    sessionStorage.removeItem(LEGACY_SEARCH_STORAGE_KEY);
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
      saveSearch({
        query: answerQuery,
        results: answerResults,
        evidenceAnswer: data,
        status: "OK",
      });
    } catch {
      setAnswerError("Không thể kết nối tới AI để tạo câu trả lời.");
    } finally {
      setIsAnswering(false);
    }
  }

  const uniqueResults = results.filter(
    (result, index) => results.findIndex((item) => item.documentId === result.documentId) === index,
  );
  const displayResults = uniqueResults;
  const isBusy = isSearching || isAnswering;

  return (
    <div>
      <form className="search-bar active-search question-search" onSubmit={handleSubmit}>
        <Search size={20} />
        <input
          aria-label="Tìm hoặc hỏi tài liệu"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nhập từ khóa, chủ đề hoặc câu hỏi..."
          value={query}
        />
        <button disabled={isBusy || query.trim().length < 2} type="submit">
          {isSearching ? <LoaderCircle className="spin" size={17} /> : null}
          {isSearching ? "Đang tìm" : "Tìm kiếm"}
        </button>
      </form>

      {!searchedQuery && (
        <div className="query-examples">
          <span>Thử:</span>
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
          <h2>{searchStatus === "EMPTY_LIBRARY" ? "Thư viện chưa có tài liệu" : "Không tìm thấy đoạn phù hợp"}</h2>
          <p>
            {searchStatus === "EMPTY_LIBRARY"
              ? "Hãy thêm tài liệu trước để ScholarFlow có dữ liệu tìm kiếm và trả lời."
              : "Thư viện chưa có tài liệu đủ liên quan. Thử từ khóa khác hoặc thêm tài liệu mới."}
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
              <button
                className="ai-curate-button"
                disabled={isBusy}
                onClick={() => answerFromResults(searchedQuery, results)}
                type="button"
              >
                {isAnswering ? <LoaderCircle className="spin" size={17} /> : <MessageSquareQuote size={17} />}
                {isAnswering ? "Đang trả lời" : evidenceAnswer ? "Tạo lại câu trả lời" : "AI trả lời từ kết quả"}
              </button>
              <button className="search-clear-button" disabled={isBusy} onClick={handleClearSearch} type="button">
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
