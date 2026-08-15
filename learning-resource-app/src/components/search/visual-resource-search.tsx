"use client";

/* eslint-disable @next/next/no-img-element -- Blob URLs are user-selected local files, not optimizable app assets. */

import Link from "next/link";
import { ArrowUpRight, FileImage, FileSearch, Hand, LoaderCircle, MousePointer2, RotateCcw, Search, Upload } from "lucide-react";
import { ChangeEvent, FormEvent, PointerEvent, useEffect, useRef, useState } from "react";
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
type ViewerMode = "select" | "move";
type Selection = { x: number; y: number; width: number; height: number };
type ResizeCorner = "nw" | "ne" | "sw" | "se";

const ACCEPTED_FILE_TYPES = ".png,.jpg,.jpeg,.webp,.pdf,.docx,.pptx,.epub";
const MAX_INPUT_BYTES = 40 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);
const HTML_PREVIEW_EXTENSIONS = new Set(["docx", "pptx", "epub"]);

function extensionOf(file: File) {
  return file.name.split(".").at(-1)?.toLowerCase() ?? "";
}

function nextAnimationFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export function VisualResourceSearch() {
  const inputRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const resizeRef = useRef<{ corner: ResizeCorner; clientX: number; clientY: number; original: Selection } | null>(null);
  const resizeDraftRef = useRef<Selection | null>(null);
  const requestSequenceRef = useRef(0);
  const lastSearchQueryRef = useRef("");
  const objectUrlRef = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [viewerMode, setViewerMode] = useState<ViewerMode>("select");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [draftSelection, setDraftSelection] = useState<Selection | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<SearchStatus | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  async function runSearch(searchQuery: string, sequence = ++requestSequenceRef.current) {
    const normalizedQuery = searchQuery.trim().slice(0, 500);
    if (normalizedQuery.length < 2) return;
    lastSearchQueryRef.current = normalizedQuery;
    setIsSearching(true);
    setError("");
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: normalizedQuery, chunksPerDocument: 1 }),
      });
      const data = (await response.json()) as { message?: string; status?: SearchStatus; results?: SearchResult[] };
      if (sequence !== requestSequenceRef.current) return;
      if (!response.ok) throw new Error(data.message ?? "Không thể tìm trong tài liệu.");
      setResults(data.results ?? []);
      setSearchStatus(data.status ?? ((data.results?.length ?? 0) ? "OK" : "NO_RELEVANT_RESULTS"));
    } catch (caught) {
      if (sequence !== requestSequenceRef.current) return;
      setError(caught instanceof Error ? caught.message : "Không thể tìm trong tài liệu.");
    } finally {
      if (sequence === requestSequenceRef.current) setIsSearching(false);
    }
  }

  async function recognizeSelection(region: Selection) {
    const desktop = window.scholarFlowDesktop;
    const viewer = viewerRef.current;
    if (!desktop || !viewer) {
      setError("Tìm bằng vùng chọn chỉ hoạt động trong ứng dụng ScholarFlow desktop.");
      return;
    }
    const sequence = ++requestSequenceRef.current;
    setError("");
    setIsCapturing(true);
    setIsRecognizing(false);
    try {
      await nextAnimationFrame();
      await nextAnimationFrame();
      const bounds = viewer.getBoundingClientRect();
      const capture = await desktop.captureSearchRegion({
        x: bounds.left + region.x,
        y: bounds.top + region.y,
        width: region.width,
        height: region.height,
      });
      if (sequence !== requestSequenceRef.current) return;
      setIsCapturing(false);
      setIsRecognizing(true);
      const response = await fetch("/api/search/visual/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: capture.dataUrl }),
      });
      const data = (await response.json()) as { text?: string; message?: string };
      if (sequence !== requestSequenceRef.current) return;
      if (!response.ok || !data.text) throw new Error(data.message ?? "Không nhận ra chữ trong vùng chọn.");
      setQuery(data.text);
      setIsRecognizing(false);
    } catch (caught) {
      if (sequence !== requestSequenceRef.current) return;
      setError(caught instanceof Error ? caught.message : "Không thể nhận dạng vùng chọn.");
    } finally {
      if (sequence === requestSequenceRef.current) {
        setIsCapturing(false);
        setIsRecognizing(false);
      }
    }
  }

  useEffect(() => {
    if (!selection || !file) return;
    const timer = window.setTimeout(() => void recognizeSelection(selection), 350);
    return () => window.clearTimeout(timer);
    // A new selection intentionally owns a new OCR/search request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  useEffect(() => {
    const normalizedQuery = query.trim().slice(0, 500);
    if (normalizedQuery.length < 2 || isCapturing || isRecognizing) return;
    const timer = window.setTimeout(() => {
      if (lastSearchQueryRef.current !== normalizedQuery) void runSearch(normalizedQuery);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [query, isCapturing, isRecognizing]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];
    event.target.value = "";
    if (!nextFile) return;
    const extension = extensionOf(nextFile);
    if (!IMAGE_EXTENSIONS.has(extension) && extension !== "pdf" && !HTML_PREVIEW_EXTENSIONS.has(extension)) {
      setError("Hỗ trợ ảnh, PDF, DOCX, PPTX và EPUB.");
      return;
    }
    if (nextFile.size <= 0 || nextFile.size > MAX_INPUT_BYTES) {
      setError("File phải nhỏ hơn 40 MB.");
      return;
    }
    requestSequenceRef.current += 1;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setFile(nextFile);
    setPreviewUrl("");
    setPreviewHtml("");
    setSelection(null);
    setDraftSelection(null);
    setQuery("");
    setResults([]);
    setSearchStatus(null);
    lastSearchQueryRef.current = "";
    setError("");
    setViewerMode("select");

    if (IMAGE_EXTENSIONS.has(extension) || extension === "pdf") {
      const url = URL.createObjectURL(nextFile);
      objectUrlRef.current = url;
      setPreviewUrl(url);
      return;
    }

    setIsPreparing(true);
    try {
      const form = new FormData();
      form.set("file", nextFile);
      const response = await fetch("/api/search/visual/preview", { method: "POST", body: form });
      const data = (await response.json()) as { html?: string; message?: string };
      if (!response.ok || !data.html) throw new Error(data.message ?? "Không thể xem trước file.");
      setPreviewHtml(data.html);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể xem trước file.");
    } finally {
      setIsPreparing(false);
    }
  }

  function localPoint(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)),
      y: Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)),
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (viewerMode !== "select" || !file) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = localPoint(event);
    dragStartRef.current = point;
    setSelection(null);
    setDraftSelection({ ...point, width: 0, height: 0 });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const resize = resizeRef.current;
    if (resize) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const dx = event.clientX - resize.clientX;
      const dy = event.clientY - resize.clientY;
      const originalRight = resize.original.x + resize.original.width;
      const originalBottom = resize.original.y + resize.original.height;
      const west = resize.corner.endsWith("w");
      const north = resize.corner.startsWith("n");
      const left = west ? Math.max(0, Math.min(originalRight - 12, resize.original.x + dx)) : resize.original.x;
      const right = west ? originalRight : Math.max(resize.original.x + 12, Math.min(bounds.width, originalRight + dx));
      const top = north ? Math.max(0, Math.min(originalBottom - 12, resize.original.y + dy)) : resize.original.y;
      const bottom = north ? originalBottom : Math.max(resize.original.y + 12, Math.min(bounds.height, originalBottom + dy));
      const resizedSelection = { x: left, y: top, width: right - left, height: bottom - top };
      resizeDraftRef.current = resizedSelection;
      setDraftSelection(resizedSelection);
      return;
    }
    const start = dragStartRef.current;
    if (!start) return;
    const point = localPoint(event);
    setDraftSelection({
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y),
    });
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (resizeRef.current) {
      resizeRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (resizeDraftRef.current) setSelection(resizeDraftRef.current);
      resizeDraftRef.current = null;
      setDraftSelection(null);
      return;
    }
    const start = dragStartRef.current;
    if (!start) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const point = localPoint(event);
    const completedSelection = {
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y),
    };
    dragStartRef.current = null;
    setDraftSelection(null);
    if (completedSelection.width >= 12 && completedSelection.height >= 12) {
      setSelection(completedSelection);
    } else {
      setError("Hãy kéo một vùng lớn hơn để nhận dạng.");
    }
  }

  function startResize(event: PointerEvent<HTMLButtonElement>, corner: ResizeCorner) {
    if (!selection || !viewerRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    viewerRef.current.setPointerCapture(event.pointerId);
    resizeRef.current = {
      corner,
      clientX: event.clientX,
      clientY: event.clientY,
      original: selection,
    };
    resizeDraftRef.current = selection;
    setDraftSelection(selection);
  }

  function handleTextSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(query);
  }

  const activeSelection = draftSelection ?? selection;
  const extension = file ? extensionOf(file) : "";
  const processingLabel = isCapturing ? "Đang chụp vùng chọn…" : isRecognizing ? "Docling đang đọc chữ…" : isSearching ? "Đang tìm đoạn tương tự…" : "";

  return (
    <section className="visual-search-shell">
      <input ref={inputRef} accept={ACCEPTED_FILE_TYPES} className="visually-hidden" onChange={handleFile} type="file" />
      <div className="visual-search-toolbar">
        <button className="primary-button compact" onClick={() => inputRef.current?.click()} type="button"><Upload size={17} /> {file ? "Đổi ảnh hoặc file" : "Mở ảnh hoặc file"}</button>
        {file ? <span className="visual-file-name"><FileImage size={16} /> {file.name}</span> : null}
        {file ? (
          <div className="visual-viewer-modes" aria-label="Chế độ xem">
            <button className={viewerMode === "move" ? "active" : ""} onClick={() => setViewerMode("move")} type="button"><Hand size={16} /> Di chuyển</button>
            <button className={viewerMode === "select" ? "active" : ""} onClick={() => setViewerMode("select")} type="button"><MousePointer2 size={16} /> Chọn vùng</button>
          </div>
        ) : null}
      </div>

      <div className="visual-search-grid">
        <div className="visual-viewer-panel">
          {!file ? (
            <button className="visual-drop-placeholder" onClick={() => inputRef.current?.click()} type="button">
              <FileImage size={36} /><strong>Mở nội dung cần tìm</strong><span>Ảnh, PDF, DOCX, PPTX hoặc EPUB · File chỉ dùng tạm thời, không thêm vào thư viện</span>
            </button>
          ) : null}
          {isPreparing ? <div className="visual-preview-loading"><LoaderCircle className="spin" size={28} /><span>Đang tạo bản xem trước…</span></div> : null}
          {file && !isPreparing ? (
            <div className={`visual-viewer ${viewerMode === "select" ? "is-selecting" : "is-moving"}`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} ref={viewerRef}>
              {IMAGE_EXTENSIONS.has(extension) && previewUrl ? <img alt={file.name} draggable={false} src={previewUrl} /> : null}
              {extension === "pdf" && previewUrl ? <iframe aria-label={`Xem ${file.name}`} src={previewUrl} title={file.name} /> : null}
              {HTML_PREVIEW_EXTENSIONS.has(extension) && previewHtml ? <iframe aria-label={`Xem ${file.name}`} sandbox="" srcDoc={previewHtml} title={file.name} /> : null}
              {activeSelection && !isCapturing ? (
                <div className="visual-selection" style={{ left: activeSelection.x, top: activeSelection.y, width: activeSelection.width, height: activeSelection.height }}>
                  {(["nw", "ne", "sw", "se"] as ResizeCorner[]).map((corner) => (
                    <button aria-label={`Đổi kích thước ${corner}`} className={`visual-selection-handle handle-${corner}`} key={corner} onPointerDown={(event) => startResize(event, corner)} type="button" />
                  ))}
                </div>
              ) : null}
              {viewerMode === "select" && !isCapturing ? <span className="visual-selection-hint">Kéo khung quanh câu hỏi hoặc nội dung muốn tìm</span> : null}
            </div>
          ) : null}
        </div>

        <div className="visual-results-panel">
          <div className="visual-query-heading">
            <div><span>Nội dung nhận dạng</span><strong>{processingLabel || (query ? "Có thể sửa trước khi tìm lại" : "Chưa chọn vùng")}</strong></div>
            {selection ? <button aria-label="Chọn lại vùng" onClick={() => { setSelection(null); setDraftSelection(null); }} type="button"><RotateCcw size={16} /></button> : null}
          </div>
          <form className="visual-query-form" onSubmit={handleTextSearch}>
            <textarea onChange={(event) => setQuery(event.target.value)} placeholder="Chữ trong vùng chọn sẽ hiện ở đây…" value={query} />
            <button disabled={isSearching || query.trim().length < 2} type="submit"><Search size={16} /> Tìm lại</button>
          </form>

          {error ? <div className="search-error"><strong>Chưa tìm được</strong><p>{error}</p></div> : null}
          {!error && searchStatus && results.length === 0 ? <div className="visual-no-results"><FileSearch size={24} /><strong>{searchStatus === "EMPTY_LIBRARY" ? "Thư viện chưa có tài liệu" : "Không có tài liệu phù hợp"}</strong><span>{searchStatus === "EMPTY_LIBRARY" ? "Hãy thêm tài liệu vào thư viện trước." : "Thử chọn thêm phần chữ hoặc chú thích quanh nội dung."}</span></div> : null}
          {results.length ? (
            <div className="visual-result-list">
              <div className="visual-result-count"><strong>{results.length} tài liệu phù hợp</strong><span>Chỉ hiển thị nguồn tương tự, không giải câu hỏi.</span></div>
              {results.map((result) => (
                <Link href={`/documents/${result.documentId}?chunk=${result.chunkId}#matched-chunk`} key={result.chunkId}>
                  <div className="visual-result-title"><span>{result.fileType}</span><strong>{result.title}</strong><ArrowUpRight size={15} /></div>
                  <p>{result.content.slice(0, 240)}{result.content.length > 240 ? "…" : ""}</p>
                  <div className="result-tags">
                    {result.sourceLabel ? <span className="source-tag">{result.sourceLabel}</span> : null}
                    {result.primaryTopic ? <span>{result.primaryTopic}</span> : null}
                    {result.difficulty ? <span>{formatDifficulty(result.difficulty)}</span> : null}
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
