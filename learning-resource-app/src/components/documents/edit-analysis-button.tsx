"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Save, X } from "lucide-react";
import { analysisTopics } from "@/lib/ai/analysis-schema";

type Analysis = {
  topic: string;
  difficulty: string;
  summary: string;
  subtopics: string[];
  keywords: string[];
  reason: string;
};

function splitItems(value: string) {
  return [...new Set(value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean))];
}

export function EditAnalysisButton({ documentId, initial }: { documentId: string; initial: Analysis }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ ...initial, subtopics: initial.subtopics.join("\n"), keywords: initial.keywords.join("\n") });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    const response = await fetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, subtopics: splitItems(form.subtopics), keywords: splitItems(form.keywords) }),
    });
    const data = await response.json() as { message?: string };
    setIsSaving(false);
    if (!response.ok) return setError(data.message ?? "Không thể cập nhật kết quả");
    setIsOpen(false);
    router.refresh();
  }

  return <>
    <button className="secondary-button compact" onClick={() => setIsOpen(true)} type="button"><Pencil size={16} />Chỉnh sửa</button>
    {isOpen ? <div className="modal-backdrop" role="presentation">
      <section aria-labelledby="edit-analysis-title" aria-modal="true" className="analysis-dialog" role="dialog">
        <div className="dialog-heading"><div><p className="eyebrow">Kết quả phân tích</p><h2 id="edit-analysis-title">Chỉnh sửa phân loại</h2></div><button aria-label="Đóng" className="icon-button" disabled={isSaving} onClick={() => setIsOpen(false)} type="button"><X size={19} /></button></div>
        <form className="analysis-form" onSubmit={save}>
          <div className="form-grid-two">
            <label>Chủ đề chính<select value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })}>{analysisTopics.map((topic) => <option key={topic}>{topic}</option>)}</select></label>
            <label>Độ khó<select value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })}><option value="BEGINNER">BEGINNER</option><option value="INTERMEDIATE">INTERMEDIATE</option><option value="ADVANCED">ADVANCED</option></select></label>
          </div>
          <label>Tóm tắt<textarea rows={5} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label>
          <div className="form-grid-two">
            <label>Chủ đề con <small>Mỗi dòng hoặc cách nhau bằng dấu phẩy</small><textarea rows={5} value={form.subtopics} onChange={(event) => setForm({ ...form, subtopics: event.target.value })} /></label>
            <label>Từ khóa <small>Mỗi dòng hoặc cách nhau bằng dấu phẩy</small><textarea rows={5} value={form.keywords} onChange={(event) => setForm({ ...form, keywords: event.target.value })} /></label>
          </div>
          <label>Lý do phân loại<textarea rows={3} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="dialog-actions"><button className="secondary-button" disabled={isSaving} onClick={() => setIsOpen(false)} type="button">Hủy</button><button className="primary-button" disabled={isSaving} type="submit">{isSaving ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />}{isSaving ? "Đang lưu" : "Lưu thay đổi"}</button></div>
        </form>
      </section>
    </div> : null}
  </>;
}
