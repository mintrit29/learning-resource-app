"use client";

import { useState } from "react";
import { BrainCircuit, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export function ReanalyzeButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function reanalyze() {
    if (!window.confirm("Phân tích AI lại tài liệu này? Tóm tắt và phân loại hiện tại có thể được thay thế.")) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/documents/${documentId}/reanalyze`, { method: "POST" });
      const data = await response.json() as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Không thể chạy lại phân tích AI");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Không thể kết nối tới máy chủ");
      setLoading(false);
    }
  }

  return (
    <span className="retry-job-wrap">
      <button className="retry-job-button" disabled={loading} onClick={reanalyze} type="button">
        {loading ? <LoaderCircle className="spin" size={14} /> : <BrainCircuit size={14} />}
        Phân tích AI lại
      </button>
      {error ? <small>{error}</small> : null}
    </span>
  );
}
