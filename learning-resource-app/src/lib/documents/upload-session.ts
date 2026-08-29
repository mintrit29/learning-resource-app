import { clearUploadDraft, readUploadDraft, saveUploadDraft, type UploadDraftItem } from "./upload-draft";

type UploadSnapshot = { items: UploadDraftItem[]; isUploading: boolean };
const emptySnapshot: UploadSnapshot = { items: [], isUploading: false };
let snapshot: UploadSnapshot = { items: readUploadDraft(), isUploading: false };
const listeners = new Set<() => void>();

export const getUploadSnapshot = () => snapshot;
export const getServerUploadSnapshot = () => emptySnapshot;
export function subscribeUploadSession(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function publish(next: UploadSnapshot) {
  snapshot = next;
  saveUploadDraft(next.items);
  listeners.forEach(listener => listener());
}
export function editUploadItems(update: (items: UploadDraftItem[]) => UploadDraftItem[]) {
  if (snapshot.isUploading) return;
  publish({ ...snapshot, items: update(snapshot.items) });
}
function updateItem(id: string, changes: Partial<UploadDraftItem>) {
  publish({ ...snapshot, items: snapshot.items.map(item => item.id === id ? { ...item, ...changes } : item) });
}

// The session outlives an UploadForm mount. Navigation neither duplicates a batch
// nor discards its final status. Only the still-mounted initiating form may navigate.
export async function uploadPendingFiles(request: typeof fetch = fetch) {
  if (snapshot.isUploading) return null;
  const pending = snapshot.items.filter(item => item.status === "ready" || item.status === "error");
  if (!pending.length) return null;
  const totalCount = snapshot.items.length;
  publish({ ...snapshot, isUploading: true });
  let uploadedCount = 0;
  let failedCount = 0;
  let firstDocumentId: string | undefined;
  try {
    for (const item of pending) {
      updateItem(item.id, { status: "uploading", message: undefined, needsComponent: false });
      const form = new FormData();
      form.append("file", item.file);
      try {
        const response = await request("/api/documents/upload", { method: "POST", body: form });
        const data = await response.json() as { documentId?: string; message?: string; setupUrl?: string };
        if (!response.ok || !data.documentId) {
          failedCount += 1;
          updateItem(item.id, { status: "error", message: data.message ?? "Không thể thêm tài liệu.", needsComponent: Boolean(data.setupUrl) });
          continue;
        }
        uploadedCount += 1;
        firstDocumentId ??= data.documentId;
        updateItem(item.id, { status: "uploaded", documentId: data.documentId, message: "Đã đưa vào hàng đợi" });
      } catch {
        failedCount += 1;
        updateItem(item.id, { status: "error", message: "Không thể kết nối tới máy chủ." });
      }
    }
  } finally {
    publish({ ...snapshot, isUploading: false });
  }
  if (!failedCount) {
    publish(emptySnapshot);
    clearUploadDraft();
  }
  return { uploadedCount, failedCount, firstDocumentId, totalCount };
}
