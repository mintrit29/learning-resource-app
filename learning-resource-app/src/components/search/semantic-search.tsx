"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowUpRight, FileSearch, LoaderCircle, Search } from "lucide-react";
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
  matchReasons: string[];
};

type SearchStatus = "OK" | "NO_RELEVANT_RESULTS" | "EMPTY_LIBRARY";
type SearchFilters = {
  topic: string;
  difficulty: "" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  fileType: "" | "PDF" | "PPTX" | "DOCX" | "EPUB";
};

type SavedSearchState = {
  query: string;
  filters: SearchFilters;
  appliedFilters?: SearchFilters;
  results: SearchResult[];
  status?: SearchStatus | null;
};

const SEARCH_STORAGE_KEY = "scholarflow:resource-search:v3";
const LEGACY_SEARCH_STORAGE_KEYS = ["scholarflow:last-search", "scholarflow:last-search:v2"];
const EMPTY_FILTERS: SearchFilters = { topic: "", difficulty: "", fileType: "" };
const examples = [
  "tài liệu nền tảng về database cho người mới",
  "slide machine learning nâng cao",
  "tài liệu về phương pháp nghiên cứu",
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

function buildSuitabilityReasons(result: SearchResult, filters: SearchFilters) {
  const reasons = new Set(result.matchReasons);
  if (filters.topic && result.primaryTopic === filters.topic && !reasons.has("Đúng chủ đề")) reasons.add("Đúng chủ đề đã lọc");
  if (filters.difficulty && result.difficulty === filters.difficulty && !reasons.has("Đúng độ khó")) reasons.add("Đúng độ khó đã lọc");
  if (filters.fileType && result.fileType === filters.fileType && !reasons.has("Đúng định dạng")) reasons.add("Đúng định dạng đã lọc");
  return [...reasons];
}

export function ResourceSearch({ topics }: { topics: string[] }) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [error, setError] = useState("");
  const [searchStatus, setSearchStatus] = useState<SearchStatus | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const savedSearch = readSavedSearch();
      if (savedSearch) {
        setQuery(savedSearch.query);
        setFilters(savedSearch.filters ?? EMPTY_FILTERS);
        setAppliedFilters(savedSearch.appliedFilters ?? savedSearch.filters ?? EMPTY_FILTERS);
        setSearchedQuery(savedSearch.results?.length ? savedSearch.query : "");
        setResults(savedSearch.results ?? []);
        setSearchStatus(savedSearch.status ?? null);
      }
      LEGACY_SEARCH_STORAGE_KEYS.forEach((key) => window.sessionStorage.removeItem(key));
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, []);

  async function runSearch(normalizedQuery: string) {
    if (normalizedQuery.length < 2) return;

    setIsSearching(true);
    setError("");
    setSearchStatus(null);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: normalizedQuery,
          chunksPerDocument: 1,
          topic: filters.topic || undefined,
          difficulty: filters.difficulty || undefined,
          fileType: filters.fileType || undefined,
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
        return;
      }

      const nextResults = data.results ?? [];
      const nextStatus = data.status ?? (nextResults.length ? "OK" : "NO_RELEVANT_RESULTS");
      setResults(nextResults);
      setSearchStatus(nextStatus);
      setSearchedQuery(normalizedQuery);
      setAppliedFilters(filters);
      saveSearch({ query: normalizedQuery, filters, appliedFilters: filters, results: nextResults, status: nextStatus });
    } catch {
      setError("Không thể kết nối tới máy chủ.");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runSearch(query.trim());
  }

  function updateFilter<Key extends keyof SearchFilters>(key: Key, value: SearchFilters[Key]) {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    saveSearch({ query, filters: nextFilters, appliedFilters, results, status: searchStatus });
  }

  function handleClearSearch() {
    setResults([]);
    setSearchedQuery("");
    setError("");
    setSearchStatus(null);
    saveSearch({ query, filters, appliedFilters: filters, results: [], status: null });
  }

  const uniqueResults = results.filter(
    (result, index) => results.findIndex((item) => item.documentId === result.documentId) === index,
  );

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className="search-bar active-search resource-search-bar">
          <Search size={20} />
          <input
            aria-label="Mô tả tài liệu cần tìm"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ví dụ: tài liệu nền tảng về database cho người mới..."
            value={query}
          />
          <button disabled={isSearching || query.trim().length < 2} type="submit">
            {isSearching ? <LoaderCircle className="spin" size={17} /> : null}
            {isSearching ? "Đang tìm" : "Tìm tài liệu"}
          </button>
        </div>

        <div className="search-filters" aria-label="Lọc tài liệu">
          <label>
            <span>Chủ đề</span>
            <select onChange={(event) => updateFilter("topic", event.target.value)} value={filters.topic}>
              <option value="">Tất cả chủ đề</option>
              {topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
            </select>
          </label>
          <label>
            <span>Độ khó</span>
            <select onChange={(event) => updateFilter("difficulty", event.target.value as SearchFilters["difficulty"])} value={filters.difficulty}>
              <option value="">Tất cả độ khó</option>
              <option value="BEGINNER">Cơ bản</option>
              <option value="INTERMEDIATE">Trung cấp</option>
              <option value="ADVANCED">Nâng cao</option>
            </select>
          </label>
          <label>
            <span>Loại file</span>
            <select onChange={(event) => updateFilter("fileType", event.target.value as SearchFilters["fileType"])} value={filters.fileType}>
              <option value="">Tất cả loại file</option>
              <option value="PDF">PDF</option>
              <option value="PPTX">PPTX</option>
              <option value="DOCX">DOCX</option>
              <option value="EPUB">EPUB</option>
            </select>
          </label>
        </div>
      </form>

      {!searchedQuery && !query && (
        <div className="query-examples">
          <span>Thử:</span>
          {examples.map((example) => (
            <button key={example} onClick={() => setQuery(example)} type="button">{example}</button>
          ))}
        </div>
      )}

      {error ? <div className="search-error"><strong>Chưa tìm được</strong><p>{error}</p></div> : null}

      {!error && searchedQuery && results.length === 0 ? (
        <div className="empty-state search-empty">
          <div className="empty-icon"><FileSearch size={24} /></div>
          <h2>{searchStatus === "EMPTY_LIBRARY" ? "Thư viện chưa có tài liệu" : "Không tìm thấy tài liệu phù hợp"}</h2>
          <p>
            {searchStatus === "EMPTY_LIBRARY"
              ? "Hãy thêm tài liệu để ScholarFlow có dữ liệu phân loại và tìm kiếm."
              : "Thử mô tả nhu cầu khác hoặc nới bộ lọc chủ đề, độ khó và loại file."}
          </p>
        </div>
      ) : null}

      {uniqueResults.length ? (
        <section className="search-results">
          <div className="search-results-heading">
            <div>
              <h2>Nguồn tham khảo cho “{searchedQuery}”</h2>
              <span>{uniqueResults.length} tài liệu phù hợp</span>
            </div>
            <button className="search-clear-button" disabled={isSearching} onClick={handleClearSearch} type="button">
              Xóa kết quả
            </button>
          </div>
          {uniqueResults.map((result) => {
            const suitabilityReasons = buildSuitabilityReasons(result, appliedFilters);
            return (
              <Link href={`/documents/${result.documentId}?chunk=${result.chunkId}#matched-chunk`} key={result.chunkId}>
                <div className="result-main">
                  <div className="result-title"><span>{result.fileType}</span><h3>{result.title}</h3></div>
                  <p>{result.content.slice(0, 360)}{result.content.length > 360 ? "..." : ""}</p>
                  <div className="result-tags">
                    {result.sourceLabel ? <span className="source-tag">{result.sourceLabel}</span> : null}
                    {result.primaryTopic ? <span>{result.primaryTopic}</span> : null}
                    {result.difficulty ? <span>{formatDifficulty(result.difficulty)}</span> : null}
                  </div>
                  {suitabilityReasons.length ? (
                    <div className="result-suitability">
                      <strong>Vì sao phù hợp</strong>
                      <span>{suitabilityReasons.join(" · ")}</span>
                    </div>
                  ) : null}
                  <small className="result-citation">Nguồn: {result.title}{result.sourceLabel ? ` · ${result.sourceLabel}` : ""}</small>
                </div>
                <div className="result-open-action"><span>Mở đoạn liên quan</span><ArrowUpRight size={17} /></div>
              </Link>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
