"use client";

import { useState } from "react";
import { LoaderCircle, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";

export function RetryJobButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function retry() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/documents/${documentId}/retry`, { method: "POST" });
    const data = await response.json() as { message?: string };
    if (!response.ok) {
      setError(data.message ?? "Không thể chạy lại");
      setLoading(false);
      return;
    }
    router.refresh();
  }

  return (
    <span className="retry-job-wrap">
      <button className="retry-job-button" disabled={loading} onClick={retry} type="button">
        {loading ? <LoaderCircle className="spin" size={14} /> : <RotateCcw size={14} />}
        Xử lý phần còn thiếu
      </button>
      {error ? <small>{error}</small> : null}
    </span>
  );
}
