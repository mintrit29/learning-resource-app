"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Plus, Tags, Trash2, X } from "lucide-react";

type TagItem = { id: string; name: string; normalizedName: string; description: string | null; _count: { aliases: number; documents: number } };

export function TagManager({ initialTags }: { initialTags: TagItem[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<TagItem | null | undefined>(undefined);
  const [isMerging, setIsMerging] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [mergeForm, setMergeForm] = useState({ sourceTagId: "", targetTagId: "" });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  function open(tag: TagItem | null) {
    setEditing(tag);
    setForm({ name: tag?.name ?? "", description: tag?.description ?? "" });
    setError("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy("save"); setError("");
    const response = await fetch(editing ? `/api/tags/${editing.id}` : "/api/tags", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await response.json() as { message?: string };
    setBusy("");
    if (!response.ok) return setError(data.message ?? "Không thể lưu tag");
    setEditing(undefined); router.refresh();
  }

  async function remove(tag: TagItem) {
    if (!window.confirm(`Xóa canonical tag “${tag.name}”? Các liên kết tài liệu và aliases cũng sẽ bị xóa.`)) return;
    setBusy(tag.id); setError("");
    const response = await fetch(`/api/tags/${tag.id}`, { method: "DELETE" });
    const data = await response.json() as { message?: string };
    setBusy("");
    if (!response.ok) return setError(data.message ?? "Không thể xóa tag");
    router.refresh();
  }

  function openMerge() {
    setMergeForm({
      sourceTagId: initialTags[0]?.id ?? "",
      targetTagId: initialTags.find((tag) => tag.id !== initialTags[0]?.id)?.id ?? "",
    });
    setError("");
    setIsMerging(true);
  }

  async function merge(event: React.FormEvent) {
    event.preventDefault();
    setBusy("merge");
    setError("");
    const response = await fetch("/api/tags/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mergeForm),
    });
    const data = await response.json() as { message?: string };
    setBusy("");
    if (!response.ok) return setError(data.message ?? "Không thể gộp tag");
    setIsMerging(false);
    router.refresh();
  }

  const targetOptions = initialTags.filter((tag) => tag.id !== mergeForm.sourceTagId);

  return <>
    <div className="tag-toolbar"><div><h2>Canonical tags</h2><p>{initialTags.length} tag đã chuẩn hóa.</p></div><div className="provider-actions">{initialTags.length > 1 ? <button className="secondary-button compact" onClick={openMerge} type="button"><Tags size={17} />Gộp tag</button> : null}<button className="primary-button compact" onClick={() => open(null)} type="button"><Plus size={17} />Thêm tag</button></div></div>
    {error && editing === undefined ? <p className="tag-error">{error}</p> : null}
    {initialTags.length ? <div className="tag-table">{initialTags.map((tag) => <article key={tag.id}><span className="provider-icon"><Tags size={19} /></span><div><strong>{tag.name}</strong><small>{tag.description ?? tag.normalizedName}</small></div><div className="tag-counts"><span>{tag._count.documents} tài liệu</span><span>{tag._count.aliases} alias</span></div><div className="provider-actions"><button aria-label="Chỉnh sửa tag" className="icon-button" onClick={() => open(tag)} type="button"><Pencil size={17} /></button><button aria-label="Xóa tag" className="icon-button danger-icon" disabled={busy === tag.id} onClick={() => remove(tag)} type="button">{busy === tag.id ? <LoaderCircle className="spin" size={17} /> : <Trash2 size={17} />}</button></div></article>)}</div> : <div className="provider-empty"><Tags size={28} /><strong>Chưa có canonical tag</strong><p>Tạo tag thủ công hoặc để AI phân tích tài liệu.</p></div>}
    {editing !== undefined ? <div className="modal-backdrop" role="presentation"><section aria-modal="true" className="confirm-dialog tag-dialog" role="dialog"><div className="dialog-heading"><div><p className="eyebrow">Taxonomy</p><h2>{editing ? "Chỉnh sửa tag" : "Thêm canonical tag"}</h2></div><button aria-label="Đóng" className="icon-button" disabled={busy === "save"} onClick={() => setEditing(undefined)} type="button"><X size={19} /></button></div><form className="analysis-form" onSubmit={save}><label>Tên canonical tag<input autoFocus maxLength={100} required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Mô tả<textarea maxLength={500} rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>{error ? <p className="form-error">{error}</p> : null}<div className="dialog-actions"><button className="secondary-button" disabled={busy === "save"} onClick={() => setEditing(undefined)} type="button">Hủy</button><button className="primary-button" disabled={busy === "save"} type="submit">{busy === "save" ? <LoaderCircle className="spin" size={18} /> : null}{editing ? "Lưu thay đổi" : "Tạo tag"}</button></div></form></section></div> : null}
    {isMerging ? <div className="modal-backdrop" role="presentation"><section aria-modal="true" className="confirm-dialog tag-dialog" role="dialog"><div className="dialog-heading"><div><p className="eyebrow">Taxonomy</p><h2>Gộp tag thủ công</h2></div><button aria-label="Đóng" className="icon-button" disabled={busy === "merge"} onClick={() => setIsMerging(false)} type="button"><X size={19} /></button></div><form className="analysis-form" onSubmit={merge}><p className="dialog-copy">Chọn tag muốn bỏ, rồi chọn tag chuẩn sẽ giữ lại. App sẽ chuyển tài liệu và alias sang tag giữ lại.</p><label>Tag muốn gộp/bỏ<select required value={mergeForm.sourceTagId} onChange={(event) => setMergeForm({ sourceTagId: event.target.value, targetTagId: initialTags.find((tag) => tag.id !== event.target.value)?.id ?? "" })}>{initialTags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label><label>Tag giữ lại<select required value={mergeForm.targetTagId} onChange={(event) => setMergeForm({ ...mergeForm, targetTagId: event.target.value })}>{targetOptions.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label>{error ? <p className="form-error">{error}</p> : null}<div className="dialog-actions"><button className="secondary-button" disabled={busy === "merge"} onClick={() => setIsMerging(false)} type="button">Hủy</button><button className="primary-button" disabled={busy === "merge" || !mergeForm.sourceTagId || !mergeForm.targetTagId || mergeForm.sourceTagId === mergeForm.targetTagId} type="submit">{busy === "merge" ? <LoaderCircle className="spin" size={18} /> : null}Gộp tag</button></div></form></section></div> : null}
  </>;
}
