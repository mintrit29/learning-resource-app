"use client";

import { useRef, useState } from "react";
import { LoaderCircle, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { actionErrorMessage, requestJsonAction } from "@/lib/ui-action";

export function RetryJobButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const actionPending = useRef(false);

  async function retry() {
    if (actionPending.current) return;
    actionPending.current = true;
    setLoading(true);
    setError("");
    try {
      await requestJsonAction(`/api/documents/${documentId}/retry`, { method: "POST" }, "Không thể chạy lại");
      router.refresh();
    } catch (caught) { setError(actionErrorMessage(caught, "Không thể chạy lại")); }
    finally { actionPending.current = false; setLoading(false); }
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
