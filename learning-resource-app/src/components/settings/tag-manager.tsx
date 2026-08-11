"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Plus, Tags, Trash2, X } from "lucide-react";

type TagItem = {
  id: string;
  name: string;
  normalizedName: string;
  description: string | null;
  isClassificationEnabled: boolean;
  aliases: Array<{ id: string; alias: string }>;
  _count: { aliases: number; documents: number };
};

export function TagManager({ initialTags }: { initialTags: TagItem[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<TagItem | null | undefined>(undefined);
  const [isMerging, setIsMerging] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [mergeForm, setMergeForm] = useState({ sourceTagId: "", targetTagId: "" });
  const [expandedAliases, setExpandedAliases] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  function open(tag: TagItem | null) {
    setEditing(tag);
    setForm({ name: tag?.name ?? "", description: tag?.description ?? "" });
    setError("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy("save");
    setError("");
    const response = await fetch(editing ? `/api/tags/${editing.id}` : "/api/tags", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = (await response.json()) as { message?: string };
    setBusy("");
    if (!response.ok) return setError(data.message ?? "Không thể lưu môn học");
    setEditing(undefined);
    router.refresh();
  }

  async function remove(tag: TagItem) {
    if (!window.confirm(`Xóa môn “${tag.name}”? Tài liệu thuộc môn này sẽ được chuyển sang “Chưa phân loại”.`)) return;
    setBusy(tag.id);
    setError("");
    const response = await fetch(`/api/tags/${tag.id}`, { method: "DELETE" });
    const data = (await response.json()) as { message?: string };
    setBusy("");
    if (!response.ok) return setError(data.message ?? "Không thể xóa môn học");
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
    const data = (await response.json()) as { message?: string };
    setBusy("");
    if (!response.ok) return setError(data.message ?? "Không thể gộp môn học");
    setIsMerging(false);
    router.refresh();
  }

  const targetOptions = initialTags.filter((tag) => tag.id !== mergeForm.sourceTagId);
  const enabledCount = initialTags.filter((tag) => tag.isClassificationEnabled).length;
  const legacyCount = initialTags.length - enabledCount;
  const visibleAliasLimit = 6;

  function toggleAliases(tagId: string) {
    setExpandedAliases((current) => {
      const next = new Set(current);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  return (
    <>
      <div className="tag-toolbar">
        <div>
          <h2>Danh sách môn học</h2>
          <p>
            {enabledCount} môn được phép phân loại
            {legacyCount ? ` · ${legacyCount} mục cũ đang chờ bạn xác nhận` : ""}. AI không thể tự thêm môn mới.
          </p>
        </div>
        <div className="provider-actions">
          {initialTags.length > 1 ? (
            <button className="secondary-button compact" onClick={openMerge} type="button">
              <Tags size={17} />
              Gộp môn học
            </button>
          ) : null}
          <button className="primary-button compact" onClick={() => open(null)} type="button">
            <Plus size={17} />
            Thêm môn học
          </button>
        </div>
      </div>

      {error && editing === undefined ? <p className="tag-error">{error}</p> : null}

      {initialTags.length ? (
        <div className="tag-table">
          {initialTags.map((tag) => (
            <article key={tag.id}>
              <span className="provider-icon">
                <Tags size={19} />
              </span>
              <div>
                <strong>{tag.name}</strong>
                {!tag.isClassificationEnabled ? <span className="legacy-topic-badge">Chưa duyệt cho AI · chỉnh sửa để bật</span> : null}
                <small>{tag.description ?? "Tên chính dùng để lọc và hiển thị trong tài liệu."}</small>
                {tag.aliases.length ? (
                  <div className="tag-alias-list" aria-label={`Tên gọi khác của ${tag.name}`}>
                    {(expandedAliases.has(tag.id) ? tag.aliases : tag.aliases.slice(0, visibleAliasLimit)).map((alias) => (
                      <span key={alias.id}>{alias.alias}</span>
                    ))}
                    {tag.aliases.length > visibleAliasLimit ? (
                      <button className="tag-alias-toggle" onClick={() => toggleAliases(tag.id)} type="button">
                        {expandedAliases.has(tag.id) ? "Thu gọn" : `+${tag.aliases.length - visibleAliasLimit} tên khác`}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="tag-alias-list empty-alias">Chưa có tên gọi khác</div>
                )}
              </div>
              <div className="tag-counts">
                <span>{tag._count.documents} tài liệu</span>
                <span>{tag._count.aliases} tên gọi khác</span>
              </div>
              <div className="provider-actions">
                <button aria-label="Chỉnh sửa môn học" className="icon-button" onClick={() => open(tag)} type="button">
                  <Pencil size={17} />
                </button>
                <button
                  aria-label="Xóa môn học"
                  className="icon-button danger-icon"
                  disabled={busy === tag.id}
                  onClick={() => remove(tag)}
                  type="button"
                >
                  {busy === tag.id ? <LoaderCircle className="spin" size={17} /> : <Trash2 size={17} />}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="provider-empty">
          <Tags size={28} />
          <strong>Chưa có môn học</strong>
          <p>Hãy thêm ít nhất một môn học để AI có thể phân loại tài liệu.</p>
        </div>
      )}

      {editing !== undefined ? (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="confirm-dialog tag-dialog" role="dialog">
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">Môn học</p>
                <h2>{editing ? "Chỉnh sửa môn học" : "Thêm môn học"}</h2>
              </div>
              <button aria-label="Đóng" className="icon-button" disabled={busy === "save"} onClick={() => setEditing(undefined)} type="button">
                <X size={19} />
              </button>
            </div>
            <form className="analysis-form" onSubmit={save}>
              <label>
                Tên môn học
                <input autoFocus maxLength={100} required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </label>
              <label>
                Ghi chú
                <textarea maxLength={500} rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </label>
              {error ? <p className="form-error">{error}</p> : null}
              <div className="dialog-actions">
                <button className="secondary-button" disabled={busy === "save"} onClick={() => setEditing(undefined)} type="button">
                  Hủy
                </button>
                <button className="primary-button" disabled={busy === "save"} type="submit">
                  {busy === "save" ? <LoaderCircle className="spin" size={18} /> : null}
                  {editing ? "Lưu thay đổi" : "Tạo môn học"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {isMerging ? (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="confirm-dialog tag-dialog" role="dialog">
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">Môn học</p>
                <h2>Gộp môn học thủ công</h2>
              </div>
              <button aria-label="Đóng" className="icon-button" disabled={busy === "merge"} onClick={() => setIsMerging(false)} type="button">
                <X size={19} />
              </button>
            </div>
            <form className="analysis-form" onSubmit={merge}>
              <p className="dialog-copy">Chọn môn muốn bỏ, rồi chọn môn sẽ giữ lại. App sẽ chuyển tài liệu và tên gọi khác sang môn giữ lại.</p>
              <label>
                Môn học muốn gộp/bỏ
                <select
                  required
                  value={mergeForm.sourceTagId}
                  onChange={(event) =>
                    setMergeForm({
                      sourceTagId: event.target.value,
                      targetTagId: initialTags.find((tag) => tag.id !== event.target.value)?.id ?? "",
                    })
                  }
                >
                  {initialTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Môn học giữ lại
                <select required value={mergeForm.targetTagId} onChange={(event) => setMergeForm({ ...mergeForm, targetTagId: event.target.value })}>
                  {targetOptions.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </label>
              {error ? <p className="form-error">{error}</p> : null}
              <div className="dialog-actions">
                <button className="secondary-button" disabled={busy === "merge"} onClick={() => setIsMerging(false)} type="button">
                  Hủy
                </button>
                <button
                  className="primary-button"
                  disabled={busy === "merge" || !mergeForm.sourceTagId || !mergeForm.targetTagId || mergeForm.sourceTagId === mergeForm.targetTagId}
                  type="submit"
                >
                  {busy === "merge" ? <LoaderCircle className="spin" size={18} /> : null}
                  Gộp môn học
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
