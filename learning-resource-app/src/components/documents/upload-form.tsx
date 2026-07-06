"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, LoaderCircle, UploadCloud, X } from "lucide-react";
import {
  MAX_UPLOAD_FILE_SIZE_BYTES,
  MAX_UPLOAD_FILE_SIZE_MB,
  SUPPORTED_UPLOAD_ACCEPT,
  SUPPORTED_UPLOAD_EXTENSIONS,
  SUPPORTED_UPLOAD_LABEL,
} from "@/lib/documents/upload-policy";

function formatFileSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  function chooseFile(candidate?: File) {
    setError("");
    if (!candidate) return;
    const extension = candidate.name.split(".").pop()?.toLowerCase() ?? "";
    if (!SUPPORTED_UPLOAD_EXTENSIONS.includes(extension as (typeof SUPPORTED_UPLOAD_EXTENSIONS)[number])) {
      setError(`Chỉ hỗ trợ ${SUPPORTED_UPLOAD_LABEL}.`);
      return;
    }
    if (candidate.size === 0 || candidate.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
      setError(`File phải có dung lượng từ 1 byte đến ${MAX_UPLOAD_FILE_SIZE_MB} MB.`);
      return;
    }
    setFile(candidate);
  }

  async function uploadFile() {
    if (!file) return;
    setError("");
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as {
        documentId?: string;
        message?: string;
      };
      if (!response.ok || !data.documentId) {
        setError(data.message ?? "Không thể thêm tài liệu.");
        setIsUploading(false);
        return;
      }
      router.push(`/documents/${data.documentId}`);
      router.refresh();
    } catch {
      setError("Không thể kết nối tới máy chủ.");
      setIsUploading(false);
    }
  }

  return (
    <div>
      <div
        className={`upload-zone ${isDragging ? "dragging" : ""}`}
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
          chooseFile(event.dataTransfer.files[0]);
        }}
      >
        <input
          ref={inputRef}
          accept={SUPPORTED_UPLOAD_ACCEPT}
          className="visually-hidden"
          onChange={(event) => chooseFile(event.target.files?.[0])}
          type="file"
        />
        {!file ? (
          <>
            <UploadCloud size={34} />
            <h2>Kéo thả file vào đây</h2>
            <p>Hoặc chọn file từ máy tính. Mỗi file tối đa {MAX_UPLOAD_FILE_SIZE_MB} MB.</p>
            <button className="primary-button compact" onClick={() => inputRef.current?.click()} type="button">
              <FileText size={18} />
              Chọn tài liệu
            </button>
            <small>Hỗ trợ: {SUPPORTED_UPLOAD_LABEL}</small>
          </>
        ) : (
          <div className="selected-file">
            <span>
              <FileText size={25} />
            </span>
            <div>
              <strong>{file.name}</strong>
              <small>{formatFileSize(file.size)}</small>
            </div>
            <button
              aria-label="Bỏ chọn file"
              className="icon-button"
              disabled={isUploading}
              onClick={() => setFile(null)}
              type="button"
            >
              <X size={18} />
            </button>
          </div>
        )}
      </div>
      {error ? <p className="upload-error">{error}</p> : null}
      {file ? (
        <div className="upload-actions">
          <p>
            {isUploading
              ? "Đang lưu file và bắt đầu đọc nội dung..."
              : "File đã sẵn sàng. Bấm nút bên phải để đưa vào thư viện."}
          </p>
          <button className="primary-button compact" disabled={isUploading} onClick={uploadFile} type="button">
            {isUploading ? <LoaderCircle className="spin" size={18} /> : <UploadCloud size={18} />}
            {isUploading ? "Đang thêm..." : "Thêm vào thư viện"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
