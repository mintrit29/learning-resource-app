export type VisualSearchResult = {
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

export type VisualSearchStatus = "OK" | "NO_RELEVANT_RESULTS" | "EMPTY_LIBRARY";
export type VisualViewerMode = "select" | "move";
export type VisualSelection = { x: number; y: number; width: number; height: number };

export type VisualSearchDraft = {
  file: File | null;
  previewHtml: string;
  previewItemCount: number;
  currentPreviewItem: number;
  previewSessionId: string | null;
  zoom: number;
  viewerMode: VisualViewerMode;
  selection: VisualSelection | null;
  query: string;
  capturedPreview: string;
  results: VisualSearchResult[];
  searchStatus: VisualSearchStatus | null;
  savedAt: number;
};

const DRAFT_TTL_MS = 15 * 60 * 1_000;
let currentDraft: VisualSearchDraft | null = null;

export function readVisualSearchDraft() {
  if (currentDraft && Date.now() - currentDraft.savedAt > DRAFT_TTL_MS) currentDraft = null;
  return currentDraft;
}

export function saveVisualSearchDraft(draft: Omit<VisualSearchDraft, "savedAt">) {
  currentDraft = { ...draft, savedAt: Date.now() };
}

export function clearVisualSearchDraft() {
  currentDraft = null;
}
