"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  FolderOpen,
  LoaderCircle,
  UploadCloud,
  X,
} from "lucide-react";
import {
  MAX_BATCH_UPLOAD_FILES,
  MAX_UPLOAD_FILE_SIZE_BYTES,
  MAX_UPLOAD_FILE_SIZE_MB,
  SUPPORTED_UPLOAD_ACCEPT,
  SUPPORTED_UPLOAD_EXTENSIONS,
  SUPPORTED_UPLOAD_LABEL,
} from "@/lib/documents/upload-policy";
import {
  clearUploadDraft,
  readUploadDraft,
  saveUploadDraft,
  type UploadDraftItem as UploadItem,
} from "@/lib/documents/upload-draft";

function formatFileSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function fileKey(file: File) {
  return [file.webkitRelativePath || file.name, file.size, file.lastModified].join(":");
}

function isSupportedFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return SUPPORTED_UPLOAD_EXTENSIONS.includes(
    extension as (typeof SUPPORTED_UPLOAD_EXTENSIONS)[number],
  );
}

export function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>(readUploadDraft);
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [needsComponent, setNeedsComponent] = useState(false);

  useEffect(() => {
    folderInputRef.current?.setAttribute("webkitdirectory", "");
  }, []);

  useEffect(() => {
    saveUploadDraft(items);
    const hasUnfinishedWork = items.some((item) => item.status !== "uploaded");
    if (!hasUnfinishedWork) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [items]);

  function chooseFiles(candidates: File[]) {
    setError("");
    if (!candidates.length) return;

    const accepted: UploadItem[] = [];
    let unsupportedCount = 0;
    let invalidSizeCount = 0;
    const existingKeys = new Set(items.map((item) => item.id));

    for (const candidate of candidates) {
      if (!isSupportedFile(candidate)) {
        unsupportedCount += 1;
        continue;
      }
      if (candidate.size === 0 || candidate.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
        invalidSizeCount += 1;
        continue;
      }
      const id = fileKey(candidate);
      if (!existingKeys.has(id)) {
        accepted.push({ id, file: candidate, status: "ready" });
        existingKeys.add(id);
      }
    }

    const availableSlots = Math.max(0, MAX_BATCH_UPLOAD_FILES - items.length);
    const filesToAdd = accepted.slice(0, availableSlots);
    setItems((current) => [...current, ...filesToAdd]);

    const messages: string[] = [];
    if (unsupportedCount) messages.push(`${unsupportedCount} file không thuộc ${SUPPORTED_UPLOAD_LABEL}`);
    if (invalidSizeCount) {
      messages.push(`${invalidSizeCount} file rỗng hoặc lớn hơn ${MAX_UPLOAD_FILE_SIZE_MB} MB`);
    }
    if (accepted.length > availableSlots) {
      messages.push(`mỗi lượt chỉ nhận tối đa ${MAX_BATCH_UPLOAD_FILES} file`);
    }
    if (messages.length) setError(`Đã bỏ qua ${messages.join(", ")}.`);
  }

  function updateItem(id: string, changes: Partial<UploadItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }

  async function uploadFiles() {
    const pendingItems = items.filter((item) => item.status === "ready" || item.status === "error");
    if (!pendingItems.length) return;

    setError("");
    setNeedsComponent(false);
    setIsUploading(true);
    let uploadedCount = 0;
    let failedCount = 0;
    let firstDocumentId: string | undefined;

    for (const item of pendingItems) {
      updateItem(item.id, { status: "uploading", message: undefined });
      const formData = new FormData();
      formData.append("file", item.file);

      try {
        const response = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });
        const data = (await response.json()) as {
          documentId?: string;
          message?: string;
          setupUrl?: string;
        };
        if (!response.ok || !data.documentId) {
          failedCount += 1;
          updateItem(item.id, {
            status: "error",
            message: data.message ?? "Không thể thêm tài liệu.",
          });
          if (data.setupUrl) setNeedsComponent(true);
          continue;
        }

        uploadedCount += 1;
        firstDocumentId ??= data.documentId;
        updateItem(item.id, {
          status: "uploaded",
          documentId: data.documentId,
          message: "Đã đưa vào hàng đợi",
        });
      } catch {
        failedCount += 1;
        updateItem(item.id, { status: "error", message: "Không thể kết nối tới máy chủ." });
      }
    }

    setIsUploading(false);
    if (failedCount > 0) {
      setError(`${failedCount} file chưa tải lên được. Bạn có thể bấm thử lại.`);
      router.refresh();
      return;
    }
    setItems([]);
    clearUploadDraft();
    if (uploadedCount === 1 && firstDocumentId && items.length === 1) {
      router.push(`/documents/${firstDocumentId}`);
    } else if (uploadedCount > 0) {
      router.push("/documents");
    }
    router.refresh();
  }

  const completedCount = items.filter((item) => item.status === "uploaded").length;
  const failedCount = items.filter((item) => item.status === "error").length;

  return (
    <div>
      <div
        className={`upload-zone ${isDragging ? "dragging" : ""} ${items.length ? "has-files" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          chooseFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <input
          ref={inputRef}
          accept={SUPPORTED_UPLOAD_ACCEPT}
          className="visually-hidden"
          multiple
          onChange={(event) => {
            chooseFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
          type="file"
        />
        <input
          ref={folderInputRef}
          accept={SUPPORTED_UPLOAD_ACCEPT}
          className="visually-hidden"
          multiple
          onChange={(event) => {
            chooseFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
          type="file"
        />

        {!items.length ? (
          <>
            <UploadCloud size={34} />
            <h2>Kéo thả một hoặc nhiều file vào đây</h2>
            <p>Mỗi file tối đa {MAX_UPLOAD_FILE_SIZE_MB} MB, tối đa {MAX_BATCH_UPLOAD_FILES} file một lượt.</p>
            <div className="upload-choice-buttons">
              <button className="primary-button compact" onClick={() => inputRef.current?.click()} type="button">
                <FileText size={18} />
                Chọn file
              </button>
              <button className="secondary-button compact" onClick={() => folderInputRef.current?.click()} type="button">
                <FolderOpen size={18} />
                Quét thư mục
              </button>
            </div>
            <small>Hỗ trợ: {SUPPORTED_UPLOAD_LABEL}</small>
            <small className="folder-picker-note">
              Khi quét thư mục, cửa sổ Windows chỉ hiện thư mục và ẩn các file bên trong. Chọn thư mục rồi bấm Upload;
              app sẽ tự lấy {SUPPORTED_UPLOAD_LABEL}.
            </small>
          </>
        ) : (
          <div className="selected-files-panel">
            <div className="selected-files-heading">
              <div>
                <strong>{items.length} tài liệu đã chọn</strong>
                <small>Các tài liệu sẽ được xử lý lần lượt để tránh quá tải máy.</small>
              </div>
              <div className="upload-choice-buttons">
                <button className="secondary-button compact" disabled={isUploading} onClick={() => inputRef.current?.click()} type="button">
                  <FileText size={16} /> Thêm file
                </button>
                <button className="secondary-button compact" disabled={isUploading} onClick={() => folderInputRef.current?.click()} type="button">
                  <FolderOpen size={16} /> Quét thêm thư mục
                </button>
              </div>
            </div>
            <small className="folder-picker-note selected-files-folder-note">
              Windows ẩn file trong cửa sổ chọn thư mục; app sẽ tự quét {SUPPORTED_UPLOAD_LABEL} sau khi bạn bấm Upload.
            </small>
            <div className="selected-files-list">
              {items.map((item) => (
                <div className={`selected-file status-${item.status}`} key={item.id}>
                  <span>
                    {item.status === "uploading" ? <LoaderCircle className="spin" size={22} /> : null}
                    {item.status === "uploaded" ? <CheckCircle2 size={22} /> : null}
                    {item.status === "error" ? <AlertCircle size={22} /> : null}
                    {item.status === "ready" ? <FileText size={22} /> : null}
                  </span>
                  <div>
                    <strong title={item.file.webkitRelativePath || item.file.name}>
                      {item.file.webkitRelativePath || item.file.name}
                    </strong>
                    <small>{item.message ?? formatFileSize(item.file.size)}</small>
                  </div>
                  <button
                    aria-label={`Bỏ chọn ${item.file.name}`}
                    className="icon-button"
                    disabled={isUploading || item.status === "uploaded"}
                    onClick={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))}
                    type="button"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {error ? <p className="upload-error">{error}</p> : null}
      {needsComponent ? <p className="foundation-note"><Link href="/settings/components">Mở Thành phần cục bộ để tải thành phần còn thiếu</Link></p> : null}
      {items.length ? (
        <div className="upload-actions">
          <p>
            {isUploading
              ? `Đang tải lên ${completedCount + 1}/${items.length}...`
              : completedCount === items.length
                ? "Tất cả tài liệu đã được đưa vào hàng đợi."
                : `${completedCount} hoàn tất${failedCount ? `, ${failedCount} cần thử lại` : ""}.`}
          </p>
          <button
            className="primary-button compact"
            disabled={isUploading || completedCount === items.length}
            onClick={uploadFiles}
            type="button"
          >
            {isUploading ? <LoaderCircle className="spin" size={18} /> : <UploadCloud size={18} />}
            {isUploading ? "Đang thêm..." : failedCount ? "Thử lại file lỗi" : "Thêm vào thư viện"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
