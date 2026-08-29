"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2, X } from "lucide-react";
import { dismissFromBackdrop, useDismissableDialog } from "@/lib/dismissable-dialog";
import { actionErrorMessage, requestJsonAction } from "@/lib/ui-action";

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
  const actionPending = useRef(false);
  useDismissableDialog(isOpen, isDeleting, () => setIsOpen(false));

  async function deleteDocument() {
    if (actionPending.current) return;
    actionPending.current = true;
    setError("");
    setIsDeleting(true);
    try {
      await requestJsonAction(`/api/documents/${documentId}`, { method: "DELETE" }, "Không thể xóa tài liệu");
      setIsOpen(false);
      router.push("/documents");
      router.refresh();
    } catch (caught) { setError(actionErrorMessage(caught, "Không thể xóa tài liệu")); }
    finally { actionPending.current = false; setIsDeleting(false); }
  }

  return (
    <>
      <button className="danger-button compact" onClick={() => { setError(""); setIsOpen(true); }} type="button">
        <Trash2 size={17} />Xóa tài liệu
      </button>
      {isOpen ? (
        <div className="modal-backdrop" onMouseDown={(event) => dismissFromBackdrop(event, isDeleting, () => setIsOpen(false))} role="presentation">
          <section aria-labelledby="delete-title" aria-modal="true" className="confirm-dialog" role="dialog">
            <div className="dialog-heading">
              <div><p className="eyebrow">Xác nhận thao tác</p><h2 id="delete-title">Xóa tài liệu?</h2></div>
              <button aria-label="Đóng" className="icon-button" disabled={isDeleting} onClick={() => setIsOpen(false)} type="button"><X size={19} /></button>
            </div>
            <p>
              <strong>{documentTitle}</strong>, bản sao trong thư viện ScholarFlow và dữ liệu đã trích xuất sẽ bị xóa. File nguồn bên ngoài máy của bạn vẫn được giữ nguyên.
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
