"use client";

import { Download, LoaderCircle } from "lucide-react";
import { useState, type SyntheticEvent } from "react";

type ExtractedTextDisclosureProps = {
  characterCount: number;
  documentId: string;
  downloadHref: string;
  hasText: boolean;
};

export function ExtractedTextDisclosure({
  characterCount,
  documentId,
  downloadHref,
  hasText,
}: ExtractedTextDisclosureProps) {
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    if (!event.currentTarget.open || !hasText || text || isLoading) return;
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/text?inline=1`);
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message ?? "Không thể tải nội dung đã trích xuất.");
      }
      setText(await response.text());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải nội dung đã trích xuất.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <details className="text-preview-section document-disclosure" id="extracted-text" onToggle={handleToggle}>
      <summary className="text-preview-heading">
        <div>
          <h2>Nội dung đã trích xuất</h2>
          <p>
            {hasText
              ? `Mở để xem toàn bộ ${characterCount.toLocaleString("vi-VN")} ký tự.`
              : "Nội dung đang được xử lý..."}
          </p>
        </div>
      </summary>
      {hasText ? (
        <div className="original-file-actions">
          <a className="secondary-button compact" href={downloadHref}>
            Tải .txt <Download size={15} />
          </a>
        </div>
      ) : null}
      {isLoading ? (
        <p className="inline-loading"><LoaderCircle className="spin" size={17} /> Đang tải toàn bộ nội dung…</p>
      ) : error ? (
        <p className="form-error">{error}</p>
      ) : (
        <pre>{text || "Nội dung đang được xử lý..."}</pre>
      )}
    </details>
  );
}
