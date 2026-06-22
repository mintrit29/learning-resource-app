"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, X } from "lucide-react";

type Review = { id: string; candidateTagName: string; similarity: number; suggestedTag: { name: string }; document: { title: string } | null };

export function TagMergeReviewList({ reviews }: { reviews: Review[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function resolve(id: string, action: "APPROVE" | "REJECT") {
    setBusy(id); setError("");
    const response = await fetch(`/api/tag-merge-reviews/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const data = await response.json() as { message?: string };
    setBusy("");
    if (!response.ok) return setError(data.message ?? "Không thể xử lý đề xuất");
    router.refresh();
  }
  return <section className="content-section merge-review-section"><div className="tag-toolbar"><div><h2>Đề xuất gộp tag</h2><p>{reviews.length} đề xuất đang chờ duyệt.</p></div></div>{error ? <p className="tag-error">{error}</p> : null}{reviews.length ? <div className="merge-review-list">{reviews.map((review) => <article key={review.id}><div><strong>{review.candidateTagName}</strong><span>→</span><strong>{review.suggestedTag.name}</strong><small>{review.document?.title ?? "Không có tài liệu nguồn"}</small></div><span>{(review.similarity * 100).toFixed(1)}%</span><div className="provider-actions"><button className="secondary-button compact" disabled={busy === review.id} onClick={() => resolve(review.id, "REJECT")} type="button"><X size={16} />Giữ riêng</button><button className="primary-button compact" disabled={busy === review.id} onClick={() => resolve(review.id, "APPROVE")} type="button">{busy === review.id ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}Gộp</button></div></article>)}</div> : <div className="provider-empty"><Check size={28} /><strong>Không có đề xuất đang chờ</strong><p>Các tag gần nghĩa sẽ xuất hiện tại đây.</p></div>}</section>;
}
