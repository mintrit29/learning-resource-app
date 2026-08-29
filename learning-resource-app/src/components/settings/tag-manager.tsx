"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Plus, Search, Tags, Trash2, X } from "lucide-react";
import { dismissFromBackdrop, useDismissableDialog } from "@/lib/dismissable-dialog";
import { actionErrorMessage, requestJsonAction } from "@/lib/ui-action";

type TagItem = {
  id: string;
  name: string;
  normalizedName: string;
  description: string | null;
  isClassificationEnabled: boolean;
  _count: { documents: number };
};

export function TagManager({ initialTags }: { initialTags: TagItem[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<TagItem | null | undefined>(undefined);
  const [form, setForm] = useState({ name: "", description: "" });
  const [busy, setBusy] = useState("");
  const actionPending = useRef(false);
  const [error, setError] = useState("");
  const [tagQuery, setTagQuery] = useState("");
  useDismissableDialog(editing !== undefined, busy === "save", () => setEditing(undefined));

  function open(tag: TagItem | null) {
    setEditing(tag);
    setForm({ name: tag?.name ?? "", description: tag?.description ?? "" });
    setError("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (actionPending.current) return;
    actionPending.current = true;
    setBusy("save");
    setError("");
    try {
      await requestJsonAction(editing ? `/api/tags/${editing.id}` : "/api/tags", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }, "Không thể lưu môn học");
      setEditing(undefined);
      router.refresh();
    } catch (caught) { setError(actionErrorMessage(caught, "Không thể lưu môn học")); }
    finally { actionPending.current = false; setBusy(""); }
  }

  async function remove(tag: TagItem) {
    if (actionPending.current) return;
    if (!window.confirm(`Xóa môn “${tag.name}”? Tài liệu thuộc môn này sẽ được chuyển sang “Chưa phân loại”.`)) return;
    actionPending.current = true;
    setBusy(tag.id);
    setError("");
    try {
      await requestJsonAction(`/api/tags/${tag.id}`, { method: "DELETE" }, "Không thể xóa môn học");
      router.refresh();
    } catch (caught) { setError(actionErrorMessage(caught, "Không thể xóa môn học")); }
    finally { actionPending.current = false; setBusy(""); }
  }

  const enabledCount = initialTags.filter((tag) => tag.isClassificationEnabled).length;
  const legacyCount = initialTags.length - enabledCount;
  const visibleTags = useMemo(() => {
    const query = tagQuery.trim().toLocaleLowerCase("vi");
    if (!query) return initialTags;
    return initialTags.filter((tag) => [tag.name, tag.description ?? ""]
      .some((value) => value.toLocaleLowerCase("vi").includes(query)));
  }, [initialTags, tagQuery]);

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
          <button className="primary-button compact" disabled={Boolean(busy)} onClick={() => open(null)} type="button">
            <Plus size={17} />
            Thêm môn học
          </button>
        </div>
      </div>

      <label className="tag-search">
        <Search size={17} />
        <input aria-label="Tìm môn học" onChange={(event) => setTagQuery(event.target.value)} placeholder="Tìm theo tên môn hoặc ghi chú…" value={tagQuery} />
        {tagQuery ? <button aria-label="Xóa tìm kiếm môn học" onClick={() => setTagQuery("")} type="button"><X size={16} /></button> : null}
      </label>

      {error && editing === undefined ? <p className="tag-error">{error}</p> : null}

      {visibleTags.length ? (
        <div className="tag-table">
          {visibleTags.map((tag) => (
            <article key={tag.id}>
              <span className="provider-icon">
                <Tags size={19} />
              </span>
              <div>
                <strong>{tag.name}</strong>
                {!tag.isClassificationEnabled ? <span className="legacy-topic-badge">Chưa duyệt cho AI · chỉnh sửa để bật</span> : null}
                <small>{tag.description ?? "Tên chính dùng để lọc và hiển thị trong tài liệu."}</small>
              </div>
              <div className="tag-counts">
                <span>{tag._count.documents} tài liệu</span>
              </div>
              <div className="provider-actions">
                <button aria-label="Chỉnh sửa môn học" className="icon-button" disabled={Boolean(busy)} onClick={() => open(tag)} type="button">
                  <Pencil size={17} />
                </button>
                <button
                  aria-label="Xóa môn học"
                  className="icon-button danger-icon"
                  disabled={Boolean(busy)}
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
          <strong>{initialTags.length ? "Không có môn học phù hợp" : "Chưa có môn học"}</strong>
          <p>{initialTags.length ? "Thử tên môn hoặc nội dung ghi chú." : "Hãy thêm ít nhất một môn học để AI có thể phân loại tài liệu."}</p>
        </div>
      )}

      {editing !== undefined ? (
        <div className="modal-backdrop" onMouseDown={(event) => dismissFromBackdrop(event, busy === "save", () => setEditing(undefined))} role="presentation">
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

    </>
  );
}
