"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, RefreshCw } from "lucide-react";

export function RecommendationRefresh({ projectId }: { projectId: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function refresh() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/recommend`, { method: "POST" });
      const data = await response.json() as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Không thể cập nhật gợi ý");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể cập nhật gợi ý"); } finally { setBusy(false); }
  }
  return <div className="recommend-refresh"><button className="secondary-button" disabled={busy} onClick={refresh}>{busy ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}{busy ? "Đang xếp hạng..." : "Tạo lại gợi ý"}</button>{error ? <small>{error}</small> : null}</div>;
}
