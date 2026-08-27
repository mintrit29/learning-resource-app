"use client";

/* eslint-disable @next/next/no-img-element -- Blob URLs are user-selected local files, not optimizable app assets. */

import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, FileImage, FileSearch, Hand, LoaderCircle, Minus, MousePointer2, Plus, RotateCcw, Search, Upload } from "lucide-react";
import { ChangeEvent, FormEvent, PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { formatDifficulty, formatFileType } from "@/lib/labels";
import { mapSelectionToImageCrop } from "@/lib/search/visual-image-crop";
import { removeLongGridLines } from "@/lib/search/visual-grid-cleanup";
import { readRegionText } from "@/lib/search/region-native-text";
import { usePdfPage } from "./use-pdf-page";
import { mergeRecognizedText } from "@/lib/search/visual-query";
import {
  readVisualSearchDraft,
  saveVisualSearchDraft,
  type VisualSearchResult as SearchResult,
  type VisualSearchStatus as SearchStatus,
  type VisualSelection as Selection,
  type VisualViewerMode as ViewerMode,
} from "@/lib/search/visual-search-draft";
type ResizeCorner = "nw" | "ne" | "sw" | "se";

const ACCEPTED_FILE_TYPES = ".png,.jpg,.jpeg,.webp,.pdf,.docx,.pptx,.epub,.xmind";
const MAX_INPUT_BYTES = 40 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);
const HTML_PREVIEW_EXTENSIONS = new Set(["docx", "pptx", "epub", "xmind"]);

function extensionOf(file: File) {
  return file.name.split(".").at(-1)?.toLowerCase() ?? "";
}

function nextAnimationFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(fallbackMessage);
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(fallbackMessage);
  }
}

export function VisualResourceSearch() {
  const [restoredDraft] = useState(() => readVisualSearchDraft());
  const inputRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const previewImageRef = useRef<HTMLImageElement>(null);
  const previewFrameRef = useRef<HTMLIFrameElement>(null);
  const resultsPanelRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef(restoredDraft?.viewport ?? { left: 0, top: 0, pageTop: 0, resultsTop: 0 });
  const restorePendingRef = useRef(Boolean(restoredDraft?.file));
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const panStartRef = useRef<{
    clientX: number;
    clientY: number;
    frameScrollLeft: number;
    frameScrollTop: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const resizeRef = useRef<{ corner: ResizeCorner; clientX: number; clientY: number; original: Selection } | null>(null);
  const resizeDraftRef = useRef<Selection | null>(null);
  const moveSelectionRef = useRef<{ clientX: number; clientY: number; original: Selection } | null>(null);
  const moveSelectionDraftRef = useRef<Selection | null>(null);
  const requestSequenceRef = useRef(0);
  const lastSearchQueryRef = useRef(restoredDraft?.results.length ? restoredDraft.query : "");
  const objectUrlRef = useRef<string | null>(null);
  const ocrAbortRef = useRef<AbortController | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const pageAbortRef = useRef<AbortController | null>(null);
  const previewSessionRef = useRef<string | null>(restoredDraft?.previewSessionId ?? null);
  const [file, setFile] = useState<File | null>(restoredDraft?.file ?? null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewHtml, setPreviewHtml] = useState(restoredDraft?.previewHtml ?? "");
  const [previewItemCount, setPreviewItemCount] = useState(restoredDraft?.previewItemCount ?? 0);
  const [currentPreviewItem, setCurrentPreviewItem] = useState(restoredDraft?.currentPreviewItem ?? 1);
  const [zoom, setZoom] = useState(restoredDraft?.zoom ?? 1);
  const [canvasBaseSize, setCanvasBaseSize] = useState(restoredDraft?.canvasBaseSize ?? { width: 0, height: 0 });
  const [frameSize, setFrameSize] = useState(restoredDraft?.frameSize ?? { width: 0, height: 0 });
  const [viewerMode, setViewerMode] = useState<ViewerMode>(restoredDraft?.viewerMode ?? "select");
  const [selection, setSelection] = useState<Selection | null>(restoredDraft?.selection ?? null);
  const [selectionRevision, setSelectionRevision] = useState(0);
  const [draftSelection, setDraftSelection] = useState<Selection | null>(null);
  const [query, setQuery] = useState(restoredDraft?.query ?? "");
  const [capturedPreview, setCapturedPreview] = useState(restoredDraft?.capturedPreview ?? "");
  const [results, setResults] = useState<SearchResult[]>(restoredDraft?.results ?? []);
  const [searchStatus, setSearchStatus] = useState<SearchStatus | null>(restoredDraft?.searchStatus ?? null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isChangingPage, setIsChangingPage] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [error, setError] = useState("");
  const [ocrWarning, setOcrWarning] = useState(restoredDraft?.ocrWarning ?? "");
  const pdf = usePdfPage(file, currentPreviewItem);

  const restoreViewport = useCallback(() => {
    if (!restorePendingRef.current || !viewerRef.current) return;
    const saved = viewportRef.current;
    viewerRef.current.scrollTo(saved.left, saved.top);
    resultsPanelRef.current?.scrollTo(0, saved.resultsTop);
    window.scrollTo(0, saved.pageTop);
    restorePendingRef.current = false;
  }, []);

  function rememberViewport() {
    if (restorePendingRef.current) return;
    viewportRef.current = {
      left: viewerRef.current?.scrollLeft ?? 0,
      top: viewerRef.current?.scrollTop ?? 0,
      pageTop: window.scrollY,
      resultsTop: resultsPanelRef.current?.scrollTop ?? 0,
    };
    const draft = readVisualSearchDraft();
    if (draft?.file === file) saveVisualSearchDraft({ ...draft, viewport: viewportRef.current });
  }

  const syncPreviewCanvasSize = useCallback(() => {
    const viewer = viewerRef.current;
    const shell = viewer?.parentElement;
    if (!viewer || !shell || !shell.clientWidth || !shell.clientHeight) return;
    const extension = file ? extensionOf(file) : "";
    const frameDocument = previewFrameRef.current?.contentDocument;
    // A fixed content coordinate system prevents selections moving on resize.
    const width = canvasBaseSize.width || shell.clientWidth;
    let height = canvasBaseSize.height || shell.clientHeight;
    if (HTML_PREVIEW_EXTENSIONS.has(extension) && frameDocument?.body && frameDocument.documentElement) {
      const frame = previewFrameRef.current!;
      frameDocument.documentElement.style.overflow = "hidden";
      frameDocument.querySelector<HTMLElement>(".preview-toolbar")?.style.setProperty("position", "static");
      const naturalWidth = Math.max(width, frameDocument.body.scrollWidth);
      const naturalHeight = Math.max(shell.clientHeight, frameDocument.body.scrollHeight);
      frame.style.width = `${naturalWidth}px`;
      frame.style.height = `${naturalHeight}px`;
      setFrameSize({ width: naturalWidth, height: naturalHeight });
      height = naturalHeight * width / naturalWidth;
    } else if (extension === "pdf" && pdf.page) {
      // Keep the letterbox in the same scale space as the selection.
      height = Math.max(shell.clientHeight, width * pdf.page.height / pdf.page.width);
    }
    setCanvasBaseSize(current => current.width === width && current.height === height ? current : { width, height });
  }, [file, canvasBaseSize.width, canvasBaseSize.height, pdf.page]);

  function previewReady() {
    syncPreviewCanvasSize();
    requestAnimationFrame(() => requestAnimationFrame(restoreViewport));
  }

  useEffect(() => () => {
    ocrAbortRef.current?.abort();
    searchAbortRef.current?.abort();
    previewAbortRef.current?.abort();
    pageAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    const updateTimer = window.setTimeout(() => {
      if (!file) {
        setPreviewUrl("");
        return;
      }
      const extension = extensionOf(file);
      if (!IMAGE_EXTENSIONS.has(extension)) {
        setPreviewUrl("");
        return;
      }
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      setPreviewUrl(url);
    }, 0);
    return () => {
      window.clearTimeout(updateTimer);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    };
  }, [file]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const shell = viewer?.parentElement;
    if (!viewer || !shell) return;
    const updateSize = () => syncPreviewCanvasSize();
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(shell);
    return () => observer.disconnect();
  }, [file, isPreparing, previewHtml, syncPreviewCanvasSize]);

  useEffect(() => {
    saveVisualSearchDraft({
      file,
      previewHtml,
      previewItemCount,
      currentPreviewItem,
      previewSessionId: previewSessionRef.current,
      zoom,
      viewerMode,
      selection,
      query,
      capturedPreview,
      results,
      searchStatus,
      ocrWarning,
      viewport: viewportRef.current,
      canvasBaseSize,
      frameSize,
    });
  }, [file, previewHtml, previewItemCount, currentPreviewItem, zoom, viewerMode, selection, query, capturedPreview, results, searchStatus, ocrWarning, canvasBaseSize, frameSize]);

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
      const data = await readJsonResponse<{
        message?: string;
        status?: SearchStatus;
        results?: SearchResult[];
      }>(response, "Dịch vụ tìm kiếm phản hồi không hợp lệ. Hãy thử đóng và mở lại ứng dụng.");
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

  function captureXmindImages(region: Selection) {
    const viewer = viewerRef.current;
    const frame = previewFrameRef.current;
    if (!viewer || !frame?.contentDocument) return [];
    const view = viewer.getBoundingClientRect();
    const bounds = frame.getBoundingClientRect();
    const scaleX = bounds.width / frame.offsetWidth;
    const scaleY = bounds.height / frame.offsetHeight;
    const left = (view.left + region.x - viewer.scrollLeft - bounds.left) / scaleX;
    const top = (view.top + region.y - viewer.scrollTop - bounds.top) / scaleY;
    const right = left + region.width / scaleX;
    const bottom = top + region.height / scaleY;
    const captures: string[] = [];
    for (const image of frame.contentDocument.querySelectorAll<HTMLImageElement>("img.mindmap-image")) {
      const rect = image.getBoundingClientRect();
      const x = Math.max(left, rect.left), y = Math.max(top, rect.top);
      const width = Math.min(right, rect.right) - x, height = Math.min(bottom, rect.bottom) - y;
      if (width < 2 || height < 2) continue;
      if (!image.complete || !image.naturalWidth) throw new Error("Ảnh đang tải. Hãy đợi ảnh hiện rồi chọn lại.");
      if (captures.length >= 8) throw new Error("Hãy chọn tối đa 8 ảnh mỗi lần để OCR không quá lâu.");
      const cropWidth = width * image.naturalWidth / rect.width;
      const cropHeight = height * image.naturalHeight / rect.height;
      const ratio = Math.min(1, 4096 / cropWidth, 4096 / cropHeight, Math.sqrt(8_000_000 / (cropWidth * cropHeight)));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(cropWidth * ratio));
      canvas.height = Math.max(1, Math.round(cropHeight * ratio));
      canvas.getContext("2d")!.drawImage(image, (x - rect.left) * image.naturalWidth / rect.width, (y - rect.top) * image.naturalHeight / rect.height, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
      captures.push(canvas.toDataURL("image/png"));
      canvas.width = canvas.height = 0;
    }
    return captures;
  }

  async function recognizeSelection(region: Selection) {
    const desktop = window.scholarFlowDesktop;
    const viewer = viewerRef.current;
    if (!viewer || (!desktop && !previewImageRef.current && (!file || extensionOf(file) !== "xmind"))) {
      setError("Tìm bằng vùng chọn chỉ hoạt động trong ứng dụng ScholarFlow desktop.");
      return;
    }
    const sequence = ++requestSequenceRef.current;
    setError("");
    setOcrWarning("");
    setIsCapturing(true);
    setIsRecognizing(false);
    let ocrTimeout: number | undefined;
    try {
      const nativeText = extractNativeText(region);
      // Text stays exact; only intersecting embedded image pixels go through OCR.
      if (file && extensionOf(file) === "xmind") {
        const captures = captureXmindImages(region);
        const parts = [nativeText];
        const failures: string[] = [];
        setCapturedPreview(captures[0] ?? "");
        setIsCapturing(false);
        setIsRecognizing(captures.length > 0);
        const controller = new AbortController();
        ocrAbortRef.current?.abort();
        ocrAbortRef.current = controller;
        ocrTimeout = window.setTimeout(() => controller.abort(), 90_000);
        for (const imageDataUrl of captures) {
          try {
            const response = await fetch("/api/search/visual/ocr", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageDataUrl }), signal: controller.signal,
            });
            const data = await readJsonResponse<{ text?: string; message?: string }>(response, "Dịch vụ OCR ảnh chưa sẵn sàng.");
            if (sequence !== requestSequenceRef.current) return;
            if (response.ok && data.text) parts.push(data.text);
            else failures.push(data.message ?? "Không đọc được chữ trong ảnh đã chọn.");
          } catch (caught) {
            if (sequence !== requestSequenceRef.current) return;
            failures.push(caught instanceof Error ? caught.message : "Không đọc được ảnh.");
            if (controller.signal.aborted) break;
          }
        }
        const text = [...new Set(parts.map(part => part.trim()).filter(Boolean))].join("\n");
        if (!text) throw new Error(failures[0] ?? "Vùng này không có chữ. Hãy chọn tên nhánh, ghi chú hoặc ảnh có chữ.");
        setQuery(text);
        if (failures.length) setOcrWarning(`Đã giữ phần chữ đọc được; một phần ảnh chưa đọc được: ${failures[0]}`);
        return;
      }
      await nextAnimationFrame();
      await nextAnimationFrame();
      const originalImageCapture = captureOriginalImageRegion(region);
      const bounds = viewer.getBoundingClientRect();
      const capture = originalImageCapture ?? await desktop!.captureSearchRegion({
        x: bounds.left + region.x - viewer.scrollLeft,
        y: bounds.top + region.y - viewer.scrollTop,
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
      const recognizeImage = async (imageDataUrl: string) => {
        const response = await fetch("/api/search/visual/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageDataUrl }),
          signal: ocrController.signal,
        });
        const data = await readJsonResponse<{ text?: string; message?: string }>(
          response,
          "Dịch vụ nhận dạng chưa sẵn sàng. Hãy thử đóng và mở lại ứng dụng.",
        );
        if (!response.ok || !data.text) {
          throw new Error(data.message ?? "Không nhận ra chữ trong vùng chọn.");
        }
        return data.text;
      };
      const recognizedText = await recognizeImage(capture.dataUrl);
      if (sequence !== requestSequenceRef.current) return;
      setQuery(mergeRecognizedText(recognizedText, nativeText));
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

  function captureOriginalImageRegion(region: Selection) {
    const image = previewImageRef.current;
    if (!image?.naturalWidth || !image.naturalHeight) return null;
    const crop = mapSelectionToImageCrop(
      region,
      { width: image.clientWidth, height: image.clientHeight },
      { width: image.naturalWidth, height: image.naturalHeight },
    );
    if (!crop || crop.width < 2 || crop.height < 2) return null;

    const maxScale = Math.min(
      1,
      4096 / crop.width,
      4096 / crop.height,
      Math.sqrt(8_000_000 / (crop.width * crop.height)),
    );
    const width = Math.max(1, Math.round(crop.width * maxScale));
    const height = Math.max(1, Math.round(crop.height * maxScale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
    const imageData = context.getImageData(0, 0, width, height);
    if (extension !== "pdf" && removeLongGridLines(imageData.data, width, height)) {
      context.putImageData(imageData, 0, 0);
    }
    return { dataUrl: canvas.toDataURL("image/jpeg", .95), width, height };
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
      return readRegionText(frameDocument, {
        left: (viewerBounds.left + region.x - viewer.scrollLeft - frameBounds.left) / scaleX,
        top: (viewerBounds.top + region.y - viewer.scrollTop - frameBounds.top) / scaleY,
        right: (viewerBounds.left + region.x - viewer.scrollLeft + region.width - frameBounds.left) / scaleX,
        bottom: (viewerBounds.top + region.y - viewer.scrollTop + region.height - frameBounds.top) / scaleY,
      });
    } catch {
      return "";
    }
  }

  useEffect(() => {
    if (!selection || !file || selectionRevision === 0) return;
    const timer = window.setTimeout(() => void recognizeSelection(selection), 350);
    return () => window.clearTimeout(timer);
    // A new selection intentionally owns a new OCR/search request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionRevision]);

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
      setError("Hỗ trợ ảnh, PDF, DOCX, PPTX, EPUB và XMind.");
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
    setFile(nextFile);
    restorePendingRef.current = false;
    viewportRef.current = { left: 0, top: 0, pageTop: window.scrollY, resultsTop: 0 };
    setCanvasBaseSize({ width: 0, height: 0 });
    setFrameSize({ width: 0, height: 0 });
    viewerRef.current?.scrollTo(0, 0);
    setPreviewHtml("");
    setPreviewItemCount(0);
    setCurrentPreviewItem(1);
    setZoom(1);
    setSelection(null);
    setDraftSelection(null);
    setQuery("");
    setOcrWarning("");
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

    if (IMAGE_EXTENSIONS.has(extension) || extension === "pdf") return;

    setIsPreparing(true);
    const previewController = new AbortController();
    previewAbortRef.current = previewController;
    const previewTimeout = window.setTimeout(() => previewController.abort(), 30_000);
    try {
      const response = await fetch("/api/search/visual/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "x-scholarflow-file-name": encodeURIComponent(nextFile.name),
        },
        body: nextFile,
        signal: previewController.signal,
      });
      const data = await readJsonResponse<{
        html?: string;
        itemCount?: number;
        sessionId?: string | null;
        message?: string;
      }>(response, "Không thể xem trước file. Hãy thử đóng và mở lại ứng dụng.");
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
    const viewer = event.currentTarget;
    const bounds = viewer.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(viewer.scrollWidth, event.clientX - bounds.left + viewer.scrollLeft)),
      y: Math.max(0, Math.min(viewer.scrollHeight, event.clientY - bounds.top + viewer.scrollTop)),
    };
  }

  function supersedeActiveRequests() {
    requestSequenceRef.current += 1;
    ocrAbortRef.current?.abort();
    searchAbortRef.current?.abort();
    lastSearchQueryRef.current = "";
    setQuery("");
    setOcrWarning("");
    setCapturedPreview("");
    setResults([]);
    setSearchStatus(null);
    setError("");
    setIsCapturing(false);
    setIsRecognizing(false);
    setIsSearching(false);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!file || pdf.loading || isChangingPage) return;
    if (viewerMode === "move") {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      panStartRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        frameScrollLeft: 0,
        frameScrollTop: 0,
        scrollLeft: event.currentTarget.scrollLeft,
        scrollTop: event.currentTarget.scrollTop,
      };
      setIsPanning(true);
      return;
    }
    supersedeActiveRequests();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = localPoint(event);
    dragStartRef.current = point;
    setSelection(null);
    setDraftSelection({ ...point, width: 0, height: 0 });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const pan = panStartRef.current;
    if (pan) {
      const deltaX = pan.clientX - event.clientX;
      const deltaY = pan.clientY - event.clientY;
      const maxScrollLeft = Math.max(0, event.currentTarget.scrollWidth - event.currentTarget.clientWidth);
      const maxScrollTop = Math.max(0, event.currentTarget.scrollHeight - event.currentTarget.clientHeight);
      const nextScrollLeft = Math.max(0, Math.min(maxScrollLeft, pan.scrollLeft + deltaX));
      const nextScrollTop = Math.max(0, Math.min(maxScrollTop, pan.scrollTop + deltaY));
      event.currentTarget.scrollLeft = nextScrollLeft;
      event.currentTarget.scrollTop = nextScrollTop;
      return;
    }
    const movingSelection = moveSelectionRef.current;
    if (movingSelection) {
      const maxX = Math.max(0, event.currentTarget.scrollWidth - movingSelection.original.width);
      const maxY = Math.max(0, event.currentTarget.scrollHeight - movingSelection.original.height);
      const movedSelection = {
        ...movingSelection.original,
        x: Math.max(0, Math.min(maxX, movingSelection.original.x + event.clientX - movingSelection.clientX)),
        y: Math.max(0, Math.min(maxY, movingSelection.original.y + event.clientY - movingSelection.clientY)),
      };
      moveSelectionDraftRef.current = movedSelection;
      setDraftSelection(movedSelection);
      return;
    }
    const resize = resizeRef.current;
    if (resize) {
      const dx = event.clientX - resize.clientX;
      const dy = event.clientY - resize.clientY;
      const originalRight = resize.original.x + resize.original.width;
      const originalBottom = resize.original.y + resize.original.height;
      const west = resize.corner.endsWith("w");
      const north = resize.corner.startsWith("n");
      const left = west ? Math.max(0, Math.min(originalRight - 12, resize.original.x + dx)) : resize.original.x;
      const right = west ? originalRight : Math.max(resize.original.x + 12, Math.min(event.currentTarget.scrollWidth, originalRight + dx));
      const top = north ? Math.max(0, Math.min(originalBottom - 12, resize.original.y + dy)) : resize.original.y;
      const bottom = north ? originalBottom : Math.max(resize.original.y + 12, Math.min(event.currentTarget.scrollHeight, originalBottom + dy));
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
    if (panStartRef.current) {
      panStartRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      setIsPanning(false);
      return;
    }
    if (moveSelectionRef.current) {
      moveSelectionRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (moveSelectionDraftRef.current) {
        setSelection(moveSelectionDraftRef.current);
        setSelectionRevision((current) => current + 1);
      }
      moveSelectionDraftRef.current = null;
      setDraftSelection(null);
      return;
    }
    if (resizeRef.current) {
      resizeRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (resizeDraftRef.current) {
        setSelection(resizeDraftRef.current);
        setSelectionRevision((current) => current + 1);
      }
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
      setSelectionRevision((current) => current + 1);
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

  function startMoveSelection(event: PointerEvent<HTMLDivElement>) {
    if (!selection || !viewerRef.current || viewerMode !== "select") return;
    event.preventDefault();
    event.stopPropagation();
    supersedeActiveRequests();
    viewerRef.current.setPointerCapture(event.pointerId);
    moveSelectionRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      original: selection,
    };
    moveSelectionDraftRef.current = selection;
    setDraftSelection(selection);
  }

  async function jumpToPreviewItem(nextItem: number) {
    const normalizedItem = Math.max(1, Math.min(extension === "pdf" ? pdf.pageCount : previewItemCount, nextItem));
    const sessionId = previewSessionRef.current;
    if (normalizedItem === currentPreviewItem || (extension !== "pdf" && !sessionId)) return;
    supersedeActiveRequests();
    setSelection(null);
    setDraftSelection(null);
    viewerRef.current?.scrollTo(0, 0);
    setFrameSize({ width: 0, height: 0 });
    if (extension === "pdf") {
      setCurrentPreviewItem(normalizedItem);
      return;
    }
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
      const data = await readJsonResponse<{ html?: string; itemCount?: number; message?: string }>(
        response,
        "Không thể chuyển trang xem trước. Hãy thử đóng và mở lại ứng dụng.",
      );
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
    setDraftSelection(null);
    setError("");
    setViewerMode(nextMode);
  }

  function changeZoom(nextZoom: number, anchor?: { x: number; y: number }) {
    const normalizedZoom = Math.max(1, Math.min(4, Math.round(nextZoom * 10) / 10));
    if (normalizedZoom === zoom) return;
    const viewer = viewerRef.current;
    const ratio = normalizedZoom / zoom;
    setSelection((current) => current ? {
      x: current.x * ratio,
      y: current.y * ratio,
      width: current.width * ratio,
      height: current.height * ratio,
    } : null);
    setDraftSelection(null);
    setZoom(normalizedZoom);
    if (viewer) {
      const focus = anchor ?? { x: viewer.clientWidth / 2, y: viewer.clientHeight / 2 };
      const oldLeft = viewer.scrollLeft;
      const oldTop = viewer.scrollTop;
      requestAnimationFrame(() => {
        viewer.scrollLeft = (oldLeft + focus.x) * ratio - focus.x;
        viewer.scrollTop = (oldTop + focus.y) * ratio - focus.y;
      });
    }
  }

  function handleWheel(event: WheelEvent) {
    const viewer = event.currentTarget as HTMLDivElement;
    if (event.ctrlKey) {
      event.preventDefault();
      const bounds = viewer.getBoundingClientRect();
      changeZoom(zoom + (event.deltaY < 0 ? .1 : -.1), {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
      return;
    }
    event.preventDefault();
    const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewer.clientHeight : 1;
    const maxLeft = Math.max(0, viewer.scrollWidth - viewer.clientWidth);
    const maxTop = Math.max(0, viewer.scrollHeight - viewer.clientHeight);
    const nextLeft = Math.max(0, Math.min(maxLeft, viewer.scrollLeft + (event.shiftKey ? event.deltaY : event.deltaX) * multiplier));
    const nextTop = Math.max(0, Math.min(maxTop, viewer.scrollTop + (event.shiftKey ? 0 : event.deltaY) * multiplier));
    viewer.scrollLeft = nextLeft;
    viewer.scrollTop = nextTop;
  }

  function handleTextSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(query);
  }


  // React's delegated wheel handler is passive. A local non-passive listener
  // prevents the outer page (or browser zoom) moving along with the viewer.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewer.removeEventListener("wheel", handleWheel);
  });

  const activeSelection = draftSelection ?? selection;
  const extension = file ? extensionOf(file) : "";
  const itemCount = extension === "pdf" ? pdf.pageCount : previewItemCount;
  const processingLabel = isCapturing ? "Đang chụp vùng chọn…" : isRecognizing ? "Đang đọc chữ tiếng Việt…" : isSearching ? "Đang tìm đoạn tương tự…" : "";

  return (
    <section className="visual-search-shell">
      <input ref={inputRef} accept={ACCEPTED_FILE_TYPES} className="visually-hidden" onChange={handleFile} type="file" />
      <div className="visual-search-toolbar">
        <button className="primary-button compact" onClick={() => inputRef.current?.click()} type="button"><Upload size={17} /> {file ? "Đổi ảnh hoặc file" : "Mở ảnh hoặc file"}</button>
        {file ? <span className="visual-file-name"><FileImage size={16} /> {file.name}</span> : null}
        {file ? (
          <div className="visual-viewer-modes" aria-label="Chế độ xem">
            <button className={viewerMode === "move" ? "active" : ""} onClick={() => changeViewerMode("move")} type="button"><Hand size={16} /> Kéo để xem</button>
            <button className={viewerMode === "select" ? "active" : ""} onClick={() => changeViewerMode("select")} type="button"><MousePointer2 size={16} /> Chọn vùng</button>
          </div>
        ) : null}
        {file ? (
          <div className="visual-zoom-controls" aria-label="Thu phóng">
            <button aria-label="Thu nhỏ" disabled={zoom <= 1} onClick={() => changeZoom(zoom - .1)} type="button"><Minus size={15} /></button>
            <button className="visual-zoom-reset" onClick={() => changeZoom(1)} title="Đưa nội dung về vừa khung" type="button">{zoom === 1 ? "Vừa khung" : `${Math.round(zoom * 100)}%`}</button>
            <button aria-label="Phóng to" disabled={zoom >= 4} onClick={() => changeZoom(zoom + .1)} type="button"><Plus size={15} /></button>
          </div>
        ) : null}
      </div>

      <div className="visual-search-grid">
        <div className="visual-viewer-panel">
          {file ? <p className="visual-selection-hint">Kéo để xem: di chuyển · Chọn vùng: khoanh phần chữ muốn tìm</p> : null}
          {!file ? (
            <button className="visual-drop-placeholder" onClick={() => inputRef.current?.click()} type="button">
              <FileImage size={36} /><strong>Mở nội dung cần tìm</strong><span>Ảnh, PDF, DOCX, PPTX, EPUB hoặc XMind · File chỉ dùng tạm thời, không thêm vào thư viện</span>
            </button>
          ) : null}
          {isPreparing ? <div className="visual-preview-loading"><LoaderCircle className="spin" size={28} /><span>Đang tạo bản xem trước…</span></div> : null}
          {file && !isPreparing ? (
            <div className="visual-viewer-shell">
              <div className={`visual-viewer ${viewerMode === "select" ? "is-selecting" : "is-moving"}${isPanning ? " is-panning" : ""}`} onScroll={rememberViewport} onPointerCancel={handlePointerUp} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} ref={viewerRef}>
                <div className="visual-canvas" style={{
                  width: canvasBaseSize.width ? `${canvasBaseSize.width * zoom}px` : "100%",
                  height: canvasBaseSize.height ? `${canvasBaseSize.height * zoom}px` : "100%",
                }}>
                {(extension === "pdf" ? pdf.page?.url : previewUrl) ? <img alt={file.name} draggable={false} onLoad={previewReady} ref={previewImageRef} src={extension === "pdf" ? pdf.page?.url : previewUrl} /> : null}
                {pdf.loading ? <div className="visual-preview-loading"><LoaderCircle className="spin" />Đang hiển thị trang PDF…</div> : null}
                {HTML_PREVIEW_EXTENSIONS.has(extension) && previewHtml ? <iframe aria-label={`Xem ${file.name}`} onLoad={previewReady} ref={previewFrameRef} sandbox="allow-same-origin" srcDoc={previewHtml} style={{ width: frameSize.width || canvasBaseSize.width || "100%", height: frameSize.height || 620, transform: `scale(${zoom * (frameSize.width ? canvasBaseSize.width / frameSize.width : 1)})`, transformOrigin: "top left" }} title={file.name} /> : null}
                {activeSelection && !isCapturing && !pdf.loading ? (
                  <div className="visual-selection" onPointerDown={startMoveSelection} style={{ left: activeSelection.x, top: activeSelection.y, width: activeSelection.width, height: activeSelection.height }}>
                    {(["nw", "ne", "sw", "se"] as ResizeCorner[]).map((corner) => (
                      <button aria-label={`Đổi kích thước ${corner}`} className={`visual-selection-handle handle-${corner}`} key={corner} onPointerDown={(event) => startResize(event, corner)} type="button" />
                    ))}
                  </div>
                ) : null}
                </div>
              </div>
              {itemCount > 1 && !isCapturing ? (
                <div className="visual-page-controls" onPointerDown={(event) => event.stopPropagation()}>
                  <button aria-label="Mục trước" disabled={isChangingPage || currentPreviewItem <= 1} onClick={() => void jumpToPreviewItem(currentPreviewItem - 1)} type="button"><ArrowLeft size={15} /></button>
                  <details>
                    <summary>{isChangingPage ? "Đang tải…" : `${extension === "pptx" ? "Slide" : extension === "pdf" ? "Trang" : extension === "xmind" ? "Sơ đồ" : "Phần"} ${currentPreviewItem}/${itemCount}`}</summary>
                    <div>{Array.from({ length: itemCount }, (_, index) => index + 1).map((item) => <button className={item === currentPreviewItem ? "active" : ""} disabled={isChangingPage} key={item} onClick={() => void jumpToPreviewItem(item)} type="button">{item}</button>)}</div>
                  </details>
                  <button aria-label="Mục sau" disabled={isChangingPage || currentPreviewItem >= itemCount} onClick={() => void jumpToPreviewItem(currentPreviewItem + 1)} type="button"><ArrowRight size={15} /></button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="visual-results-panel" ref={resultsPanelRef} onScroll={rememberViewport}>
          <div className="visual-query-heading">
            <div><span>Nội dung nhận dạng</span><strong>{processingLabel || (query ? "Có thể sửa trước khi tìm lại" : "Chưa chọn vùng")}</strong></div>
            {selection ? <button aria-label="Chọn lại vùng" onClick={() => { supersedeActiveRequests(); setSelection(null); setDraftSelection(null); }} type="button"><RotateCcw size={16} /></button> : null}
          </div>
          {capturedPreview ? <img alt="Vùng vừa chọn để OCR" className="visual-captured-preview" src={capturedPreview} /> : null}
          <form className="visual-query-form" onSubmit={handleTextSearch}>
            <textarea onChange={(event) => setQuery(event.target.value)} placeholder="Chữ trong vùng chọn sẽ hiện ở đây…" value={query} />
            <button disabled={isSearching || query.trim().length < 2} type="submit"><Search size={16} /> Tìm lại</button>
          </form>

          {ocrWarning ? <p className="visual-ocr-warning" role="status">{ocrWarning}</p> : null}
          {error || pdf.error ? <div className="search-error"><strong>Chưa tìm được</strong><p>{error || pdf.error}</p></div> : null}
          {!error && searchStatus && results.length === 0 ? <div className="visual-no-results"><FileSearch size={24} /><strong>{searchStatus === "EMPTY_LIBRARY" ? "Thư viện chưa có tài liệu" : "Không có tài liệu phù hợp"}</strong><span>{searchStatus === "EMPTY_LIBRARY" ? "Hãy thêm tài liệu vào thư viện trước." : "Thử chọn thêm phần chữ hoặc chú thích quanh nội dung."}</span></div> : null}
          {results.length ? (
            <div className="visual-result-list">
              <div className="visual-result-count"><strong>{results.length} tài liệu phù hợp</strong><span>Chỉ hiển thị nguồn tương tự, không giải câu hỏi.</span></div>
              {results.map((result) => (
                <Link onClick={rememberViewport} href={`/documents/${result.documentId}?chunk=${result.chunkId}&from=search&mode=visual#matched-chunk`} key={result.chunkId}>
                    <div className="visual-result-title"><span>{formatFileType(result.fileType)}</span><strong>{result.title}</strong><ArrowUpRight size={15} /></div>
                  <p>{result.content.slice(0, 240)}{result.content.length > 240 ? "…" : ""}</p>
                  <div className="result-tags">
                    {result.sourceLabel ? <span className="source-tag">{result.sourceLabel}</span> : null}
                    {result.primaryTopic ? <span>{result.primaryTopic}</span> : null}
                    {result.difficulty ? <span>{formatDifficulty(result.difficulty)}</span> : null}
                  </div>
                  {result.matchReasons.length ? (
                    <div className="result-suitability">
                      <strong>Vì sao được gợi ý</strong>
                      <span>{result.matchReasons.join(" · ")}</span>
                    </div>
                  ) : null}
                  <small className="result-citation">Nguồn: {result.title}{result.sourceLabel ? ` · ${result.sourceLabel}` : ""}</small>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
