"use client";

import { useState } from "react";
import { FolderOpen, LoaderCircle } from "lucide-react";

export function RevealDocumentButton({ documentId }: { documentId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function reveal() {
    const desktop = window.scholarFlowDesktop;
    if (!desktop) {
      setError("Chức năng này chỉ dùng được trong ScholarFlow Desktop.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await desktop.revealDocumentInFolder(documentId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể mở thư mục lưu file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="reveal-document-action">
      <button className="secondary-button compact" disabled={busy} onClick={() => void reveal()} type="button">
        {busy ? <LoaderCircle className="spin" size={15} /> : <FolderOpen size={15} />}
        {busy ? "Đang mở…" : "Hiện file trong thư mục"}
      </button>
      {error ? <small role="alert">{error}</small> : null}
    </span>
  );
}
