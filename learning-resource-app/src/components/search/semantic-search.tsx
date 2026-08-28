"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowUpRight, FileImage, FileSearch, LoaderCircle, Search, X } from "lucide-react";
import { formatDifficulty, formatFileType } from "@/lib/labels";
import { VisualResourceSearch } from "@/components/search/visual-resource-search";
import { VoiceSearchButton } from "@/components/search/voice-search-button";
import type { VoiceState } from "@/lib/search/voice-search-session";

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
  fileType: "" | "PDF" | "PPTX" | "DOCX" | "EPUB" | "IMAGE" | "AUDIO" | "XMIND";
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
  if (filters.topic && result.primaryTopic === filters.topic && !reasons.has("Đúng môn học")) reasons.add("Đúng môn học đã lọc");
  if (filters.difficulty && result.difficulty === filters.difficulty && !reasons.has("Đúng độ khó")) reasons.add("Đúng độ khó đã lọc");
  if (filters.fileType && result.fileType === filters.fileType && !reasons.has("Đúng định dạng")) reasons.add("Đúng định dạng đã lọc");
  return [...reasons];
}

export function ResourceSearch({ topics, initialMode = "text" }: { topics: string[]; initialMode?: "text" | "visual" }) {
  const [searchMode, setSearchMode] = useState<"text" | "visual">(initialMode);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const lastSearchSignatureRef = useRef("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [error, setError] = useState("");
  const [searchStatus, setSearchStatus] = useState<SearchStatus | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasRestoredSearch, setHasRestoredSearch] = useState(false);
  const [voice, setVoice] = useState<VoiceState>({ phase: "idle", message: "" });
  const [voiceReset, setVoiceReset] = useState(0);
  const voiceBusy = ["requesting", "recording", "transcribing"].includes(voice.phase);

  function editQuery(text: string) {
    setVoiceReset(value => value + 1);
    requestRef.current?.abort();
    setQuery(text);
  }

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
        if (savedSearch.results?.length || savedSearch.status) {
          lastSearchSignatureRef.current = JSON.stringify([savedSearch.query, savedSearch.filters ?? EMPTY_FILTERS]);
        }
      }
      LEGACY_SEARCH_STORAGE_KEYS.forEach((key) => window.sessionStorage.removeItem(key));
      setHasRestoredSearch(true);
    }, 0);
    return () => {
      window.clearTimeout(restoreTimer);
      requestRef.current?.abort();
    };
  }, []);

  async function runSearch(normalizedQuery: string, activeFilters = filters) {
    if (normalizedQuery.length < 2) return;

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const signature = JSON.stringify([normalizedQuery, activeFilters]);
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
          topic: activeFilters.topic || undefined,
          difficulty: activeFilters.difficulty || undefined,
          fileType: activeFilters.fileType || undefined,
        }),
        signal: controller.signal,
      });
      const data = (await response.json()) as {
        message?: string;
        status?: SearchStatus;
        results?: SearchResult[];
      };
      if (controller.signal.aborted || requestRef.current !== controller) return;
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
      setAppliedFilters(activeFilters);
      lastSearchSignatureRef.current = signature;
      saveSearch({ query: normalizedQuery, filters: activeFilters, appliedFilters: activeFilters, results: nextResults, status: nextStatus });
    } catch (caught) {
      if (controller.signal.aborted || requestRef.current !== controller) return;
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError("Không thể kết nối tới máy chủ.");
      setResults([]);
    } finally {
      if (requestRef.current === controller) setIsSearching(false);
    }
  }

  useEffect(() => {
    if (!hasRestoredSearch || voiceBusy || searchMode !== "text") return;
    const normalizedQuery = query.trim().slice(0, 500);
    if (normalizedQuery.length < 2) {
      requestRef.current?.abort();
      lastSearchSignatureRef.current = "";
      const clearTimer = window.setTimeout(() => {
        setResults([]);
        setSearchedQuery("");
        setSearchStatus(null);
        setError("");
        setIsSearching(false);
      }, 0);
      return () => window.clearTimeout(clearTimer);
    }
    const signature = JSON.stringify([normalizedQuery, filters]);
    if (signature === lastSearchSignatureRef.current) return;
    const timer = window.setTimeout(() => void runSearch(normalizedQuery, filters), 500);
    return () => window.clearTimeout(timer);
    // runSearch only reads the query and filters passed above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filters, hasRestoredSearch, voiceBusy, searchMode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (voiceBusy) return;
    await runSearch(query.trim());
  }

  function updateFilter<Key extends keyof SearchFilters>(key: Key, value: SearchFilters[Key]) {
    setVoiceReset(value => value + 1);
    requestRef.current?.abort();
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    saveSearch({ query, filters: nextFilters, appliedFilters, results, status: searchStatus });
  }

  function handleClearSearch() {
    setVoiceReset(value => value + 1);
    requestRef.current?.abort();
    lastSearchSignatureRef.current = "";
    setQuery("");
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setResults([]);
    setSearchedQuery("");
    setError("");
    setSearchStatus(null);
    window.sessionStorage.removeItem(SEARCH_STORAGE_KEY);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function changeSearchMode(mode: "text" | "visual") {
    requestRef.current?.abort();
    setSearchMode(mode);
    const url = new URL(window.location.href);
    if (mode === "visual") url.searchParams.set("mode", "visual");
    else url.searchParams.delete("mode");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  }

  const uniqueResults = results.filter(
    (result, index) => results.findIndex((item) => item.documentId === result.documentId) === index,
  );

  return (
    <div>
      <div className="search-mode-tabs" aria-label="Cách tìm tài liệu">
        <button className={searchMode === "text" ? "active" : ""} onClick={() => changeSearchMode("text")} type="button"><Search size={17} /> Nhập mô tả</button>
        <button className={searchMode === "visual" ? "active" : ""} onClick={() => changeSearchMode("visual")} type="button"><FileImage size={17} /> Ảnh hoặc file</button>
      </div>

      {searchMode === "visual" ? <VisualResourceSearch /> : null}
      <div hidden={searchMode !== "text"}>
      <form onSubmit={handleSubmit}>
        <div className="search-bar active-search resource-search-bar">
          <Search size={20} />
          <input
            aria-label="Mô tả tài liệu cần tìm"
            ref={inputRef}
            onChange={(event) => editQuery(event.target.value)}
            maxLength={500}
            placeholder="Ví dụ: tài liệu nền tảng về database cho người mới..."
            value={query}
          />
          {query ? <button aria-label="Xóa nội dung tìm kiếm" className="search-input-clear" onClick={handleClearSearch} type="button"><X size={16} /></button> : null}
          {searchMode === "text" ? <VoiceSearchButton reset={voiceReset} onState={(state) => {
            setVoice(state);
            if (state.phase === "requesting") { requestRef.current?.abort(); setIsSearching(false); }
          }} onTranscript={(text) => { lastSearchSignatureRef.current = ""; setQuery(text); inputRef.current?.focus(); }} /> : null}
          <button disabled={voiceBusy || isSearching || query.trim().length < 2} type="submit">
            {isSearching ? <LoaderCircle className="spin" size={17} /> : null}
            {isSearching ? "Đang tìm" : "Tìm ngay"}
          </button>
        </div>
        {voice.message ? <div className="voice-search-status" role="status" aria-live="polite">
          {voice.message}{voice.phase === "recording" ? " Tự dừng sau 30 giây; Esc để hủy." : ""}
          {voice.missing ? <> <Link href="/settings/components">Mở cài đặt thành phần</Link></> : null}
        </div> : null}

        <div className="search-filters" aria-label="Lọc tài liệu">
          <label>
            <span>Môn học</span>
            <select onChange={(event) => updateFilter("topic", event.target.value)} value={filters.topic}>
              <option value="">Tất cả môn học</option>
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
                <option value="IMAGE">Ảnh mind map</option>
                <option value="AUDIO">Âm thanh</option>
                <option value="XMIND">XMind</option>
            </select>
          </label>
        </div>
      </form>

      {!searchedQuery && !query && (
        <div className="query-examples">
          <span>Thử:</span>
          {examples.map((example) => (
            <button key={example} onClick={() => editQuery(example)} type="button">{example}</button>
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
              : "Thử mô tả nhu cầu khác hoặc nới bộ lọc môn học, độ khó và loại file."}
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
          </div>
          {uniqueResults.map((result) => {
            const suitabilityReasons = buildSuitabilityReasons(result, appliedFilters);
            return (
              <Link href={`/documents/${result.documentId}?chunk=${result.chunkId}&from=search&mode=text#matched-chunk`} key={result.chunkId}>
                <div className="result-main">
                <div className="result-title"><span>{formatFileType(result.fileType)}</span><h3>{result.title}</h3></div>
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
                <div className="result-open-action"><span>Xem đoạn phù hợp</span><ArrowUpRight size={17} /></div>
              </Link>
            );
          })}
        </section>
      ) : null}
      </div>
    </div>
  );
}
