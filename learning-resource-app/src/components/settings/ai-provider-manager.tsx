"use client";

import { useState } from "react";
import { Bot, Check, CircleAlert, Cloud, Cpu, LoaderCircle, Plus, Radio, TestTube2, Trash2, X } from "lucide-react";

type Provider = { id: string; type: string; displayName: string; baseUrl: string | null; defaultChatModel: string | null; isActive: boolean; authStatus: string; hasApiKey: boolean };
const choices = {
  OPENROUTER: { label: "OpenRouter", description: "Nhiều model qua một API key", icon: Cloud, baseUrl: "https://openrouter.ai/api/v1", model: "google/gemini-2.5-flash" },
  OLLAMA: { label: "Ollama", description: "Chạy model cục bộ trên máy", icon: Cpu, baseUrl: "http://localhost:11434", model: "qwen3:latest" },
  CUSTOM: { label: "Custom API", description: "9Router hoặc API tương thích OpenAI", icon: Bot, baseUrl: "", model: "" },
} as const;
type ProviderType = keyof typeof choices;

export function AiProviderManager({ initialProviders }: { initialProviders: Provider[] }) {
  const [providers, setProviders] = useState(initialProviders);
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<ProviderType>("OPENROUTER");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function addProvider(formData: FormData) {
    setBusyId("create"); setNotice(null);
    const response = await fetch("/api/ai-providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, displayName: formData.get("displayName"), baseUrl: formData.get("baseUrl"), apiKey: formData.get("apiKey") ?? "", defaultChatModel: formData.get("defaultChatModel"), isActive: providers.length === 0 }) });
    const data = await response.json() as { provider?: Provider; message?: string };
    setBusyId("");
    if (!response.ok || !data.provider) return setNotice({ kind: "error", text: data.message ?? "Không thể thêm provider" });
    setProviders((current) => [data.provider!, ...current.map((item) => ({ ...item, isActive: false }))]);
    setNotice({ kind: "ok", text: "Đã lưu provider. Hãy kiểm tra kết nối trước khi sử dụng." }); setIsOpen(false);
  }

  async function runAction(id: string, action: "test" | "activate" | "delete") {
    setBusyId(`${action}:${id}`); setNotice(null);
    const response = await fetch(action === "test" ? `/api/ai-providers/${id}/test` : `/api/ai-providers/${id}`, { method: action === "delete" ? "DELETE" : action === "activate" ? "PATCH" : "POST", ...(action === "activate" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: true }) } : {}) });
    const data = await response.json() as { message?: string }; setBusyId("");
    if (!response.ok) { if (action === "test") setProviders((items) => items.map((item) => item.id === id ? { ...item, authStatus: "ERROR" } : item)); return setNotice({ kind: "error", text: data.message ?? "Thao tác thất bại" }); }
    if (action === "delete") setProviders((items) => items.filter((item) => item.id !== id));
    if (action === "activate") setProviders((items) => items.map((item) => ({ ...item, isActive: item.id === id })));
    if (action === "test") setProviders((items) => items.map((item) => item.id === id ? { ...item, authStatus: "CONNECTED" } : item));
    setNotice({ kind: "ok", text: data.message ?? "Thao tác thành công" });
  }

  return <>
    <div className="provider-toolbar"><div><h2>Provider đã cấu hình</h2><p>Provider mặc định sẽ được dùng cho phân tích tài liệu.</p></div><button className="primary-button compact" onClick={() => setIsOpen(true)} type="button"><Plus size={17} />Thêm provider</button></div>
    {notice ? <div className={`provider-notice ${notice.kind}`} role="status">{notice.kind === "ok" ? <Check size={17} /> : <CircleAlert size={17} />}<span>{notice.text}</span></div> : null}
    {providers.length ? <div className="provider-list">{providers.map((provider) => { const Icon = choices[provider.type as ProviderType]?.icon ?? Bot; const isBusy = busyId.endsWith(provider.id); return <article className={`provider-card ${provider.isActive ? "active" : ""}`} key={provider.id}><span className="provider-icon"><Icon size={21} /></span><div className="provider-main"><div className="provider-title"><strong>{provider.displayName}</strong>{provider.isActive ? <span className="status-pill success"><i />Mặc định</span> : null}</div><p>{choices[provider.type as ProviderType]?.label ?? provider.type} · {provider.defaultChatModel}</p><small>{provider.baseUrl}</small></div><span className={`connection-state ${provider.authStatus.toLowerCase()}`}>{provider.authStatus === "CONNECTED" ? "Đã kết nối" : provider.authStatus === "ERROR" ? "Lỗi kết nối" : "Chưa kiểm tra"}</span><div className="provider-actions"><button aria-label="Kiểm tra kết nối" className="icon-button" disabled={isBusy} onClick={() => runAction(provider.id, "test")} title="Kiểm tra kết nối" type="button">{busyId === `test:${provider.id}` ? <LoaderCircle className="spin" size={18} /> : <TestTube2 size={18} />}</button><button aria-label="Đặt làm mặc định" className="icon-button" disabled={isBusy || provider.isActive} onClick={() => runAction(provider.id, "activate")} title="Đặt làm mặc định" type="button"><Radio size={18} /></button><button aria-label="Xóa provider" className="icon-button danger-icon" disabled={isBusy} onClick={() => runAction(provider.id, "delete")} title="Xóa provider" type="button"><Trash2 size={18} /></button></div></article>; })}</div> : <div className="provider-empty"><Bot size={28} /><strong>Chưa có AI provider</strong><p>Thêm OpenRouter, Ollama hoặc Custom API để bắt đầu phân tích.</p></div>}
    {isOpen ? <div className="modal-backdrop" role="presentation"><section aria-modal="true" className="provider-dialog" role="dialog"><div className="dialog-heading"><div><p className="eyebrow">AI configuration</p><h2>Thêm AI provider</h2></div><button aria-label="Đóng" className="icon-button" onClick={() => setIsOpen(false)} type="button"><X size={19} /></button></div><div className="provider-choices">{(Object.keys(choices) as ProviderType[]).map((item) => { const ItemIcon = choices[item].icon; return <button className={type === item ? "selected" : ""} key={item} onClick={() => setType(item)} type="button"><ItemIcon size={20} /><span><strong>{choices[item].label}</strong><small>{choices[item].description}</small></span></button>; })}</div><form action={addProvider} className="provider-form" key={type}><label>Tên hiển thị<input defaultValue={choices[type].label} name="displayName" required /></label><label>Base URL<input defaultValue={choices[type].baseUrl} name="baseUrl" placeholder="https://api.example.com/v1" required /></label>{type !== "OLLAMA" ? <label>API key<input autoComplete="off" name="apiKey" placeholder="••••••••••••" required type="password" /><small>Được mã hóa trước khi lưu vào database.</small></label> : null}<label>Chat model<input defaultValue={choices[type].model} name="defaultChatModel" placeholder="provider/model-id" required /></label><div className="dialog-actions"><button className="secondary-button" onClick={() => setIsOpen(false)} type="button">Hủy</button><button className="primary-button" disabled={busyId === "create"} type="submit">{busyId === "create" ? <LoaderCircle className="spin" size={18} /> : <Plus size={18} />}{busyId === "create" ? "Đang lưu" : "Thêm provider"}</button></div></form></section></div> : null}
  </>;
}
