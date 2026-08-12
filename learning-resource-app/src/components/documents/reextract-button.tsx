"use client";

import { useState } from "react";
import { FileScan, LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function ReextractButton({
  documentId,
  documentTitle,
}: {
  documentId: string;
  documentTitle: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [setupUrl, setSetupUrl] = useState("");

  async function reextract() {
    setLoading(true);
    setError("");
    setSetupUrl("");
    try {
      const response = await fetch(`/api/documents/${documentId}/reextract`, { method: "POST" });
      const data = await response.json() as { message?: string; setupUrl?: string };
      if (!response.ok) {
        setError(data.message ?? "Không thể trích xuất lại tài liệu");
        setSetupUrl(data.setupUrl ?? "");
        setLoading(false);
        return;
      }
      setIsOpen(false);
      router.refresh();
    } catch {
      setError("Không thể kết nối tới ứng dụng");
      setLoading(false);
    }
  }

  return (
    <>
      <button className="retry-job-button" onClick={() => setIsOpen(true)} type="button">
        <FileScan size={14} />Trích xuất lại
      </button>
      {isOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section aria-labelledby="reextract-title" aria-modal="true" className="confirm-dialog" role="dialog">
            <div className="dialog-heading">
              <div><p className="eyebrow">Xác nhận xử lý lại</p><h2 id="reextract-title">Trích xuất lại bằng Docling?</h2></div>
              <button aria-label="Đóng" className="icon-button" disabled={loading} onClick={() => setIsOpen(false)} type="button"><X size={19} /></button>
            </div>
            <p>
              ScholarFlow sẽ đọc lại <strong>{documentTitle}</strong>, tạo lại các đoạn, embedding và kết quả phân tích AI. Bản hiện tại được giữ cho tới khi Docling trích xuất thành công.
            </p>
            {error ? <p className="form-error">{error}</p> : null}
            {setupUrl ? <p><Link href={setupUrl}>Mở Thành phần cục bộ</Link></p> : null}
            <div className="dialog-actions">
              <button className="secondary-button" disabled={loading} onClick={() => setIsOpen(false)} type="button">Hủy</button>
              <button className="primary-button" disabled={loading} onClick={reextract} type="button">
                {loading ? <LoaderCircle className="spin" size={18} /> : <FileScan size={18} />}
                {loading ? "Đang bắt đầu" : "Trích xuất lại"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
