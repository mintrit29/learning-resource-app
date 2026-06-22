"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2, X } from "lucide-react";

export function DeleteDocumentButton({
  documentId,
  documentTitle,
}: {
  documentId: string;
  documentTitle: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  async function deleteDocument() {
    setError("");
    setIsDeleting(true);
    const response = await fetch(`/api/documents/${documentId}`, {
      method: "DELETE",
    });
    const data = (await response.json()) as { message?: string };

    if (!response.ok) {
      setError(data.message ?? "Không thể xóa tài liệu");
      setIsDeleting(false);
      return;
    }

    router.push("/documents");
    router.refresh();
  }

  return (
    <>
      <button className="danger-button compact" onClick={() => setIsOpen(true)} type="button">
        <Trash2 size={17} />Xóa tài liệu
      </button>
      {isOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section aria-labelledby="delete-title" aria-modal="true" className="confirm-dialog" role="dialog">
            <div className="dialog-heading">
              <div><p className="eyebrow">Xác nhận thao tác</p><h2 id="delete-title">Xóa tài liệu?</h2></div>
              <button aria-label="Đóng" className="icon-button" disabled={isDeleting} onClick={() => setIsOpen(false)} type="button"><X size={19} /></button>
            </div>
            <p>
              <strong>{documentTitle}</strong> cùng file gốc và dữ liệu đã trích xuất sẽ bị xóa vĩnh viễn.
            </p>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="dialog-actions">
              <button className="secondary-button" disabled={isDeleting} onClick={() => setIsOpen(false)} type="button">Hủy</button>
              <button className="danger-button" disabled={isDeleting} onClick={deleteDocument} type="button">
                {isDeleting ? <LoaderCircle className="spin" size={18} /> : <Trash2 size={18} />}
                {isDeleting ? "Đang xóa" : "Xóa vĩnh viễn"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
