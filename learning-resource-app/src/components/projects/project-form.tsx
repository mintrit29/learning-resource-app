"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Sparkles } from "lucide-react";

export function ProjectForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: form.get("title"), description: form.get("description"), targetDifficulty: form.get("difficulty") || null, keywords: String(form.get("keywords") ?? "").split(",").map((value) => value.trim()).filter(Boolean) }) });
      const data = await response.json() as { project?: { id: string }; message?: string };
      if (!response.ok || !data.project) throw new Error(data.message ?? "Không thể tạo project");
      router.push(`/projects/${data.project.id}`); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tạo project"); setBusy(false); }
  }
  return (
    <section className="project-create">
      <div><h2>Tạo project mới</h2><p>Hệ thống sẽ tìm và xếp hạng tài liệu ngay sau khi tạo.</p></div>
      <form onSubmit={submit}>
        <label><span>Topic</span><input name="title" minLength={3} maxLength={160} placeholder="Ví dụ: Xây dựng hệ thống phát hiện phishing" required /></label>
        <label className="project-description"><span>Mô tả mục tiêu</span><textarea name="description" minLength={10} maxLength={3000} placeholder="Bạn muốn nghiên cứu hoặc xây dựng điều gì?" required rows={3} /></label>
        <label><span>Độ khó mục tiêu</span><select name="difficulty" defaultValue=""><option value="">Không giới hạn</option><option value="BEGINNER">Cơ bản</option><option value="INTERMEDIATE">Trung cấp</option><option value="ADVANCED">Nâng cao</option></select></label>
        <label><span>Canonical tags / từ khóa</span><input name="keywords" placeholder="cybersecurity, phishing, machine learning" /><small>Phân cách bằng dấu phẩy.</small></label>
        {error ? <p className="project-error">{error}</p> : null}
        <button className="primary-button" disabled={busy} type="submit">{busy ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}{busy ? "Đang tạo gợi ý..." : "Tạo project và gợi ý"}</button>
      </form>
    </section>
  );
}
