"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, LoaderCircle, UploadCloud, X } from "lucide-react";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ["pdf", "pptx", "docx", "epub"];

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
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      setError("Chỉ hỗ trợ PDF, PPTX, DOCX và EPUB");
      return;
    }
    if (candidate.size === 0 || candidate.size > MAX_FILE_SIZE) {
      setError("File phải có dung lượng từ 1 byte đến 25 MB");
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
        setError(data.message ?? "Không thể tải tài liệu");
        setIsUploading(false);
        return;
      }
      router.push(`/documents/${data.documentId}`);
      router.refresh();
    } catch {
      setError("Không thể kết nối tới máy chủ");
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
          accept=".pdf,.pptx,.docx,.epub"
          className="visually-hidden"
          onChange={(event) => chooseFile(event.target.files?.[0])}
          type="file"
        />
        {!file ? (
          <>
            <UploadCloud size={32} />
            <h2>Kéo thả tài liệu vào đây</h2>
            <p>Hoặc chọn file từ máy tính. Tối đa 25 MB mỗi file.</p>
            <button className="primary-button compact" onClick={() => inputRef.current?.click()} type="button">
              <FileText size={18} />Chọn tài liệu
            </button>
            <small>PDF, PPTX, DOCX, EPUB</small>
          </>
        ) : (
          <div className="selected-file">
            <span><FileText size={25} /></span>
            <div><strong>{file.name}</strong><small>{formatFileSize(file.size)}</small></div>
            <button aria-label="Bỏ chọn file" className="icon-button" disabled={isUploading} onClick={() => setFile(null)} type="button"><X size={18} /></button>
          </div>
        )}
      </div>
      {error ? <p className="upload-error">{error}</p> : null}
      {file ? (
        <div className="upload-actions">
          <p>{isUploading ? "Đang lưu file và trích xuất nội dung..." : "File đã sẵn sàng để xử lý."}</p>
          <button className="primary-button compact" disabled={isUploading} onClick={uploadFile} type="button">
            {isUploading ? <LoaderCircle className="spin" size={18} /> : <UploadCloud size={18} />}
            {isUploading ? "Đang xử lý" : "Tải lên và trích xuất"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
