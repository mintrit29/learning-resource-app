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
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          description: form.get("description"),
          targetDifficulty: form.get("difficulty") || null,
          keywords: String(form.get("keywords") ?? "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      });
      const data = (await response.json()) as { project?: { id: string }; message?: string };
      if (!response.ok || !data.project) throw new Error(data.message ?? "Không thể tạo đề tài.");
      router.push(`/projects/${data.project.id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo đề tài.");
      setBusy(false);
    }
  }

  return (
    <section className="project-create">
      <div>
        <h2>Tạo đề tài mới</h2>
        <p>Viết mục tiêu học/nghiên cứu. App sẽ tìm tài liệu liên quan trong thư viện của bạn.</p>
      </div>
      <form onSubmit={submit}>
        <label>
          <span>Tên đề tài</span>
          <input
            name="title"
            minLength={3}
            maxLength={160}
            placeholder="Ví dụ: Hệ thống phát hiện phishing"
            required
          />
        </label>
        <label className="project-description">
          <span>Bạn muốn tìm hiểu hoặc xây dựng gì?</span>
          <textarea
            name="description"
            minLength={10}
            maxLength={3000}
            placeholder="Mô tả mục tiêu, câu hỏi nghiên cứu hoặc bài toán bạn đang làm..."
            required
            rows={3}
          />
        </label>
        <label>
          <span>Mức độ mong muốn</span>
          <select name="difficulty" defaultValue="">
            <option value="">Không giới hạn</option>
            <option value="BEGINNER">Cơ bản</option>
            <option value="INTERMEDIATE">Trung cấp</option>
            <option value="ADVANCED">Nâng cao</option>
          </select>
        </label>
        <label>
          <span>Từ khóa gợi ý</span>
          <input name="keywords" placeholder="cybersecurity, phishing, machine learning" />
          <small>Có thể bỏ trống. Nếu nhập nhiều từ, phân cách bằng dấu phẩy.</small>
        </label>
        {error ? <p className="project-error">{error}</p> : null}
        <button className="primary-button" disabled={busy} type="submit">
          {busy ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}
          {busy ? "Đang tìm tài liệu..." : "Tạo đề tài và gợi ý"}
        </button>
      </form>
    </section>
  );
}
