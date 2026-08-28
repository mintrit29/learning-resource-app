export type UploadDraftStatus = "ready" | "uploading" | "uploaded" | "error";

export type UploadDraftItem = {
  id: string;
  file: File;
  status: UploadDraftStatus;
  message?: string;
  documentId?: string;
  needsComponent?: boolean;
};

export function getUploadFeedback(items: UploadDraftItem[], isUploading: boolean) {
  const failed = items.filter((item) => item.status === "error");
  return {
    message: !isUploading && failed.length
      ? `${failed.length} file chưa tải lên được. Bạn có thể bấm thử lại.`
      : "",
    needsComponent: failed.some((item) => item.needsComponent),
  };
}

const DRAFT_TTL_MS = 30 * 60 * 1_000;
let draft: { items: UploadDraftItem[]; savedAt: number } | null = null;

export function readUploadDraft() {
  if (draft && Date.now() - draft.savedAt > DRAFT_TTL_MS) draft = null;
  return draft?.items.map((item) => ({
    ...item,
    status: item.status === "uploading" ? "ready" as const : item.status,
  })) ?? [];
}

export function saveUploadDraft(items: UploadDraftItem[]) {
  draft = items.length ? { items, savedAt: Date.now() } : null;
}

export function clearUploadDraft() {
  draft = null;
}
