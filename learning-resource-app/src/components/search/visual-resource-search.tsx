"use client";

/* eslint-disable @next/next/no-img-element -- Blob URLs are user-selected local files, not optimizable app assets. */

import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, FileImage, FileSearch, Hand, LoaderCircle, Minus, MousePointer2, Plus, RotateCcw, Search, Upload } from "lucide-react";
import { ChangeEvent, FormEvent, PointerEvent, useEffect, useRef, useState } from "react";
import { formatDifficulty } from "@/lib/labels";
import { mergeRecognizedText, normalizeVisualQueryText } from "@/lib/search/visual-query";

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
  const previewFrameRef = useRef<HTMLIFrameElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const resizeRef = useRef<{ corner: ResizeCorner; clientX: number; clientY: number; original: Selection } | null>(null);
  const resizeDraftRef = useRef<Selection | null>(null);
  const requestSequenceRef = useRef(0);
  const lastSearchQueryRef = useRef("");
  const objectUrlRef = useRef<string | null>(null);
  const ocrAbortRef = useRef<AbortController | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const pageAbortRef = useRef<AbortController | null>(null);
  const previewSessionRef = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewItemCount, setPreviewItemCount] = useState(0);
  const [currentPreviewItem, setCurrentPreviewItem] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [viewerMode, setViewerMode] = useState<ViewerMode>("select");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [draftSelection, setDraftSelection] = useState<Selection | null>(null);
  const [query, setQuery] = useState("");
  const [capturedPreview, setCapturedPreview] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<SearchStatus | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isChangingPage, setIsChangingPage] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    ocrAbortRef.current?.abort();
    searchAbortRef.current?.abort();
    previewAbortRef.current?.abort();
    pageAbortRef.current?.abort();
    if (previewSessionRef.current) {
      void fetch(`/api/search/visual/preview?sessionId=${encodeURIComponent(previewSessionRef.current)}`, {
        method: "DELETE",
        keepalive: true,
      });
    }
  }, []);

  async function runSearch(searchQuery: string, sequence = ++requestSequenceRef.current) {
    const normalizedQuery = searchQuery.trim().slice(0, 500);
    if (normalizedQuery.length < 2) return;
    lastSearchQueryRef.current = normalizedQuery;
    searchAbortRef.current?.abort();
    const searchController = new AbortController();
    searchAbortRef.current = searchController;
    const searchTimeout = window.setTimeout(() => searchController.abort(), 30_000);
    setIsSearching(true);
    setError("");
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: normalizedQuery, chunksPerDocument: 1 }),
        signal: searchController.signal,
      });
      const data = (await response.json()) as { message?: string; status?: SearchStatus; results?: SearchResult[] };
      if (sequence !== requestSequenceRef.current) return;
      if (!response.ok) throw new Error(data.message ?? "Không thể tìm trong tài liệu.");
      setResults(data.results ?? []);
      setSearchStatus(data.status ?? ((data.results?.length ?? 0) ? "OK" : "NO_RELEVANT_RESULTS"));
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        if (sequence === requestSequenceRef.current) setError("Tìm kiếm quá 30 giây và đã được dừng.");
        return;
      }
      if (sequence !== requestSequenceRef.current) return;
      setError(caught instanceof Error ? caught.message : "Không thể tìm trong tài liệu.");
    } finally {
      window.clearTimeout(searchTimeout);
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
    let ocrTimeout: number | undefined;
    try {
      const nativeText = extractNativeText(region);
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
      setCapturedPreview(capture.dataUrl);
      setIsCapturing(false);
      setIsRecognizing(true);
      ocrAbortRef.current?.abort();
      const ocrController = new AbortController();
      ocrAbortRef.current = ocrController;
      ocrTimeout = window.setTimeout(() => ocrController.abort(), 90_000);
      const response = await fetch("/api/search/visual/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: capture.dataUrl }),
        signal: ocrController.signal,
      });
      const data = (await response.json()) as { text?: string; message?: string };
      if (sequence !== requestSequenceRef.current) return;
      if (!response.ok || !data.text) throw new Error(data.message ?? "Không nhận ra chữ trong vùng chọn.");
      setQuery(mergeRecognizedText(data.text, nativeText));
      setIsRecognizing(false);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        if (sequence === requestSequenceRef.current) setError("OCR quá 90 giây và đã được dừng.");
        return;
      }
      if (sequence !== requestSequenceRef.current) return;
      setError(caught instanceof Error ? caught.message : "Không thể nhận dạng vùng chọn.");
    } finally {
      if (ocrTimeout !== undefined) window.clearTimeout(ocrTimeout);
      if (sequence === requestSequenceRef.current) {
        setIsCapturing(false);
        setIsRecognizing(false);
      }
    }
  }

  function extractNativeText(region: Selection) {
    const viewer = viewerRef.current;
    const frame = previewFrameRef.current;
    const frameDocument = frame?.contentDocument;
    if (!viewer || !frame || !frameDocument) return "";
    try {
      const viewerBounds = viewer.getBoundingClientRect();
      const frameBounds = frame.getBoundingClientRect();
      const scaleX = frameBounds.width / frame.offsetWidth;
      const scaleY = frameBounds.height / frame.offsetHeight;
      const selectedBounds = {
        left: viewerBounds.left + region.x,
        top: viewerBounds.top + region.y,
        right: viewerBounds.left + region.x + region.width,
        bottom: viewerBounds.top + region.y + region.height,
      };
      const walker = frameDocument.createTreeWalker(frameDocument.body, window.NodeFilter.SHOW_TEXT);
      const selectedText: string[] = [];
      let node = walker.nextNode();
      while (node) {
        const text = normalizeVisualQueryText(node.textContent ?? "");
        if (text) {
          const range = frameDocument.createRange();
          range.selectNodeContents(node);
          const intersectsSelection = [...range.getClientRects()].some((rect) => {
            const bounds = {
              left: frameBounds.left + rect.left * scaleX,
              top: frameBounds.top + rect.top * scaleY,
              right: frameBounds.left + rect.right * scaleX,
              bottom: frameBounds.top + rect.bottom * scaleY,
            };
            return bounds.left < selectedBounds.right
              && bounds.right > selectedBounds.left
              && bounds.top < selectedBounds.bottom
              && bounds.bottom > selectedBounds.top;
          });
          if (intersectsSelection) selectedText.push(text);
        }
        node = walker.nextNode();
      }
      return selectedText.join(" ").slice(0, 1_500);
    } catch {
      return "";
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
    const sequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = sequence;
    ocrAbortRef.current?.abort();
    searchAbortRef.current?.abort();
    previewAbortRef.current?.abort();
    pageAbortRef.current?.abort();
    if (previewSessionRef.current) {
      void fetch(`/api/search/visual/preview?sessionId=${encodeURIComponent(previewSessionRef.current)}`, {
        method: "DELETE",
        keepalive: true,
      });
      previewSessionRef.current = null;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setFile(nextFile);
    setPreviewUrl("");
    setPreviewHtml("");
    setPreviewItemCount(0);
    setCurrentPreviewItem(1);
    setZoom(1);
    setSelection(null);
    setDraftSelection(null);
    setQuery("");
    setCapturedPreview("");
    setResults([]);
    setSearchStatus(null);
    lastSearchQueryRef.current = "";
    setError("");
    setIsPreparing(false);
    setIsChangingPage(false);
    setIsCapturing(false);
    setIsRecognizing(false);
    setIsSearching(false);
    setViewerMode("select");

    if (IMAGE_EXTENSIONS.has(extension) || extension === "pdf") {
      const url = URL.createObjectURL(nextFile);
      objectUrlRef.current = url;
      setPreviewUrl(url);
      return;
    }

    setIsPreparing(true);
    const previewController = new AbortController();
    previewAbortRef.current = previewController;
    const previewTimeout = window.setTimeout(() => previewController.abort(), 30_000);
    try {
      const form = new FormData();
      form.set("file", nextFile);
      const response = await fetch("/api/search/visual/preview", { method: "POST", body: form, signal: previewController.signal });
      const data = (await response.json()) as { html?: string; itemCount?: number; sessionId?: string | null; message?: string };
      if (sequence !== requestSequenceRef.current) return;
      if (!response.ok || !data.html) throw new Error(data.message ?? "Không thể xem trước file.");
      setPreviewHtml(data.html);
      setPreviewItemCount(data.itemCount ?? 0);
      previewSessionRef.current = data.sessionId ?? null;
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        if (sequence === requestSequenceRef.current) setError("Tạo bản xem trước quá 30 giây và đã được dừng.");
        return;
      }
      if (sequence !== requestSequenceRef.current) return;
      setError(caught instanceof Error ? caught.message : "Không thể xem trước file.");
    } finally {
      window.clearTimeout(previewTimeout);
      if (sequence === requestSequenceRef.current) setIsPreparing(false);
    }
  }

  function localPoint(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)),
      y: Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)),
    };
  }

  function supersedeActiveRequests() {
    requestSequenceRef.current += 1;
    ocrAbortRef.current?.abort();
    searchAbortRef.current?.abort();
    setIsCapturing(false);
    setIsRecognizing(false);
    setIsSearching(false);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (viewerMode !== "select" || !file) return;
    supersedeActiveRequests();
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
    supersedeActiveRequests();
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

  async function jumpToPreviewItem(nextItem: number) {
    const normalizedItem = Math.max(1, Math.min(previewItemCount, nextItem));
    const sessionId = previewSessionRef.current;
    if (!sessionId || normalizedItem === currentPreviewItem) return;
    setSelection(null);
    setDraftSelection(null);
    pageAbortRef.current?.abort();
    const controller = new AbortController();
    pageAbortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    setIsChangingPage(true);
    setError("");
    try {
      const response = await fetch("/api/search/visual/preview", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, item: normalizedItem }),
        signal: controller.signal,
      });
      const data = (await response.json()) as { html?: string; itemCount?: number; message?: string };
      if (!response.ok || !data.html) throw new Error(data.message ?? "Không thể chuyển trang xem trước.");
      if (previewSessionRef.current !== sessionId) return;
      setPreviewHtml(data.html);
      setPreviewItemCount(data.itemCount ?? previewItemCount);
      setCurrentPreviewItem(normalizedItem);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        if (previewSessionRef.current === sessionId) setError("Chuyển trang quá 30 giây và đã được dừng.");
        return;
      }
      if (previewSessionRef.current === sessionId) {
        setError(caught instanceof Error ? caught.message : "Không thể chuyển trang xem trước.");
      }
    } finally {
      window.clearTimeout(timeout);
      if (previewSessionRef.current === sessionId) setIsChangingPage(false);
    }
  }

  function changeViewerMode(nextMode: ViewerMode) {
    if (nextMode === "move") {
      setSelection(null);
      setDraftSelection(null);
    }
    setViewerMode(nextMode);
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
            <button className={viewerMode === "move" ? "active" : ""} onClick={() => changeViewerMode("move")} type="button"><Hand size={16} /> Di chuyển</button>
            <button className={viewerMode === "select" ? "active" : ""} onClick={() => changeViewerMode("select")} type="button"><MousePointer2 size={16} /> Chọn vùng</button>
          </div>
        ) : null}
        {file && extension !== "pdf" ? (
          <div className="visual-zoom-controls" aria-label="Thu phóng">
            <button aria-label="Thu nhỏ" disabled={zoom <= .75} onClick={() => setZoom((value) => Math.max(.75, value - .25))} type="button"><Minus size={15} /></button>
            <span>{Math.round(zoom * 100)}%</span>
            <button aria-label="Phóng to" disabled={zoom >= 2} onClick={() => setZoom((value) => Math.min(2, value + .25))} type="button"><Plus size={15} /></button>
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
              {IMAGE_EXTENSIONS.has(extension) && previewUrl ? <img alt={file.name} draggable={false} src={previewUrl} style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%`, maxWidth: "none" }} /> : null}
              {extension === "pdf" && previewUrl ? <iframe aria-label={`Xem ${file.name}`} src={previewUrl} title={file.name} /> : null}
              {HTML_PREVIEW_EXTENSIONS.has(extension) && previewHtml ? <iframe aria-label={`Xem ${file.name}`} ref={previewFrameRef} sandbox="allow-same-origin" srcDoc={previewHtml} style={{ width: `${100 / zoom}%`, height: `${100 / zoom}%`, transform: `scale(${zoom})`, transformOrigin: "top left" }} title={file.name} /> : null}
              {activeSelection && !isCapturing ? (
                <div className="visual-selection" style={{ left: activeSelection.x, top: activeSelection.y, width: activeSelection.width, height: activeSelection.height }}>
                  {(["nw", "ne", "sw", "se"] as ResizeCorner[]).map((corner) => (
                    <button aria-label={`Đổi kích thước ${corner}`} className={`visual-selection-handle handle-${corner}`} key={corner} onPointerDown={(event) => startResize(event, corner)} type="button" />
                  ))}
                </div>
              ) : null}
              {viewerMode === "select" && !isCapturing ? <span className="visual-selection-hint">Kéo khung quanh câu hỏi hoặc nội dung muốn tìm</span> : null}
              {previewItemCount > 1 && !isCapturing ? (
                <div className="visual-page-controls" onPointerDown={(event) => event.stopPropagation()}>
                  <button aria-label="Mục trước" disabled={isChangingPage || currentPreviewItem <= 1} onClick={() => void jumpToPreviewItem(currentPreviewItem - 1)} type="button"><ArrowLeft size={15} /></button>
                  <details>
                    <summary>{isChangingPage ? "Đang tải…" : `${extension === "pptx" ? "Slide" : "Phần"} ${currentPreviewItem}/${previewItemCount}`}</summary>
                    <div>{Array.from({ length: previewItemCount }, (_, index) => index + 1).map((item) => <button className={item === currentPreviewItem ? "active" : ""} disabled={isChangingPage} key={item} onClick={() => void jumpToPreviewItem(item)} type="button">{item}</button>)}</div>
                  </details>
                  <button aria-label="Mục sau" disabled={isChangingPage || currentPreviewItem >= previewItemCount} onClick={() => void jumpToPreviewItem(currentPreviewItem + 1)} type="button"><ArrowRight size={15} /></button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="visual-results-panel">
          <div className="visual-query-heading">
            <div><span>Nội dung nhận dạng</span><strong>{processingLabel || (query ? "Có thể sửa trước khi tìm lại" : "Chưa chọn vùng")}</strong></div>
            {selection ? <button aria-label="Chọn lại vùng" onClick={() => { setSelection(null); setDraftSelection(null); }} type="button"><RotateCcw size={16} /></button> : null}
          </div>
          {capturedPreview ? <img alt="Vùng vừa chọn để OCR" className="visual-captured-preview" src={capturedPreview} /> : null}
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
