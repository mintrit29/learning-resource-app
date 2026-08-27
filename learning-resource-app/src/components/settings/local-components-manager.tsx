"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Download, HardDrive, LoaderCircle, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";

const labels: Record<LocalComponentState, string> = {
  missing: "Chưa cài đặt",
  downloading: "Đang tải",
  verifying: "Đang kiểm tra",
  ready: "Sẵn sàng",
  corrupt: "Cần tải lại",
  error: "Có lỗi",
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
}

export function LocalComponentsManager({ onboarding = false }: { onboarding?: boolean }) {
  const [response, setResponse] = useState<LocalComponentsResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<LocalComponentId | null>(null);

  async function refresh() {
    if (!window.scholarFlowDesktop) return;
    setResponse(await window.scholarFlowDesktop.getComponentStatus());
  }

  useEffect(() => {
    const desktop = window.scholarFlowDesktop;
    const timer = window.setTimeout(() => {
      if (!desktop) {
        setError("Quản lý model chỉ khả dụng trong ứng dụng ScholarFlow Desktop.");
        return;
      }
      void desktop.getComponentStatus()
        .then(setResponse)
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Không đọc được trạng thái thành phần"));
    }, 0);
    const unsubscribe = desktop?.onComponentProgress((progress) => {
      setResponse((current) => current ? {
        ...current,
        components: current.components.map((component) => component.id === progress.id ? progress : component),
      } : current);
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe?.();
    };
  }, []);

  const requiredComponents = response?.components.filter((component) => !component.optional) ?? [];
  const allReady = requiredComponents.every((component) => component.status === "ready");
  const summaryComponents = onboarding ? requiredComponents : response?.components ?? [];
  const totalBytes = summaryComponents.reduce((sum, component) => sum + component.totalBytes, 0);
  const downloadedBytes = summaryComponents.reduce((sum, component) => sum + component.downloadedBytes, 0);
  const progress = totalBytes ? Math.min(100, Math.round(downloadedBytes / totalBytes * 100)) : 0;

  async function run(id: LocalComponentId, action: "install" | "verify" | "remove") {
    const desktop = window.scholarFlowDesktop;
    if (!desktop) return;
    if (action === "remove" && !window.confirm("Xóa thành phần này? Bạn có thể tải lại bất kỳ lúc nào và dữ liệu tài liệu sẽ không bị xóa.")) return;
    setBusy(id);
    setError("");
    if (action === "verify") {
      setResponse((current) => current ? {
        ...current,
        components: current.components.map((component) => component.id === id
          ? { ...component, status: "verifying", error: null }
          : component),
      } : current);
    }
    try {
      if (action === "install") await desktop.installComponent(id);
      if (action === "verify") await desktop.verifyComponent(id);
      if (action === "remove") await desktop.removeComponent(id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể thực hiện thao tác");
    } finally {
      setBusy(null);
      await refresh().catch(() => undefined);
    }
  }

  async function installMissing() {
    if (!response) return;
    for (const component of response.components) {
      if (!component.optional && component.status !== "ready") await run(component.id, "install");
    }
  }

  if (!response) {
    return <div className="component-notice">{error || "Đang đọc trạng thái thành phần…"}</div>;
  }

  return (
    <section className="component-manager">
      <div className="component-summary">
        <div><HardDrive size={22} /><span><strong>{formatBytes(totalBytes)}</strong><small>Dung lượng tải về</small></span></div>
        <div><ShieldCheck size={22} /><span><strong>{formatBytes(response?.freeBytes ?? 0)}</strong><small>Dung lượng trống</small></span></div>
      </div>
      {onboarding ? <div className="component-total-progress"><span style={{ width: `${progress}%` }} /></div> : null}
      <div className="component-grid">
        {response?.components.filter((component) => !onboarding || !component.optional).map((component) => {
          const active = component.status === "downloading" || component.status === "verifying";
          const itemProgress = component.totalBytes ? Math.round(component.downloadedBytes / component.totalBytes * 100) : 0;
          return (
            <article className="component-card" key={component.id}>
              <div className="component-card-heading">
                <span className={`component-state state-${component.status}`}>{component.status === "ready" ? <CheckCircle2 size={20} /> : active ? <LoaderCircle className="spin" size={20} /> : <HardDrive size={20} />}</span>
                <div><h2>{component.name}</h2><p>{labels[component.status]} · {component.version}{component.optional ? " · Tùy chọn" : ""}</p></div>
              </div>
              <p>{component.id === "docling"
                ? "Đọc PDF, DOCX, PPTX, EPUB và OCR hình ảnh."
                : component.id === "whisper"
                ? "Chuyển giọng nói tiếng Việt và tiếng Anh trong MP3, WAV, M4A thành nội dung tìm kiếm."
                : "Tạo vector 1.024 chiều cho tìm kiếm ngữ nghĩa và dẫn nguồn."}</p>
              {active ? <div className="component-progress"><span style={{ width: `${itemProgress}%` }} /></div> : null}
              {component.error ? <p className="form-error">{component.error}</p> : null}
              <div className="component-actions">
                {active ? (
                  <button className="secondary-button compact" onClick={() => window.scholarFlowDesktop?.cancelComponentInstall(component.id)} type="button"><X size={16} /> Hủy</button>
                ) : component.status === "ready" ? (
                  <>
                    <button className="secondary-button compact" disabled={busy === component.id} onClick={() => run(component.id, "verify")} type="button"><RefreshCw size={16} /> Kiểm tra</button>
                    <button className="danger-button compact" disabled={busy === component.id} onClick={() => run(component.id, "remove")} type="button"><Trash2 size={16} /> Xóa</button>
                  </>
                ) : (
                  <button className="primary-button compact" disabled={Boolean(busy)} onClick={() => run(component.id, "install")} type="button"><Download size={16} /> {component.status === "missing" ? "Tải" : "Tải lại"}</button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {onboarding ? (
        <div className="setup-actions">
          <button className="primary-button" disabled={allReady || Boolean(busy)} onClick={installMissing} type="button"><Download size={18} />{allReady ? "Đã thiết lập xong" : "Tải và thiết lập"}</button>
          <Link className="secondary-button" href="/dashboard">{allReady ? "Tiếp tục" : "Để sau"}</Link>
        </div>
      ) : null}
    </section>
  );
}
