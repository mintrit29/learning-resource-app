"use client";

import { useState } from "react";
import {
  Bot,
  Check,
  CircleAlert,
  Cloud,
  Cpu,
  LoaderCircle,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  TestTube2,
  Trash2,
  X,
} from "lucide-react";

type Provider = {
  id: string;
  type: string;
  displayName: string;
  baseUrl: string | null;
  defaultChatModel: string | null;
  isActive: boolean;
  authStatus: string;
  hasApiKey: boolean;
};

const choices = {
  OPENROUTER: {
    label: "OpenRouter",
    description: "Dùng API key để truy cập nhiều model cloud.",
    hint: "Phù hợp nếu bạn muốn dùng model cloud ổn định và có sẵn API key OpenRouter.",
    icon: Cloud,
    baseUrl: "https://openrouter.ai/api/v1",
    model: "google/gemini-2.5-flash",
  },
  OLLAMA: {
    label: "Ollama",
    description: "Dùng model Ollama đang chạy trên máy của bạn.",
    hint: "Hãy mở Ollama trên máy, sau đó dùng địa chỉ mặc định http://localhost:11434 và chọn model đã tải.",
    icon: Cpu,
    baseUrl: "http://localhost:11434",
    model: "qwen3:latest",
  },
  CUSTOM: {
    label: "Custom API",
    description: "Kết nối endpoint tương thích chat completions.",
    hint: "Dùng khi bạn có một dịch vụ API riêng. Chỉ cần base URL, API key nếu có và tên model.",
    icon: Bot,
    baseUrl: "",
    model: "",
  },
} as const;

type ProviderType = keyof typeof choices;

function providerTypeLabel(type: string) {
  return choices[type as ProviderType]?.label ?? type;
}

function connectionLabel(status: string) {
  if (status === "CONNECTED") return "Đã kết nối";
  if (status === "ERROR") return "Có lỗi";
  return "Chưa kiểm tra";
}

async function readApiResponse<T extends object>(response: Response): Promise<Partial<T>> {
  try {
    const data = await response.json() as unknown;
    return data && typeof data === "object" ? data as Partial<T> : {};
  } catch {
    return {};
  }
}

function responseMessage(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized && normalized.length <= 180 ? normalized : fallback;
}

export function AiProviderManager({ initialProviders }: { initialProviders: Provider[] }) {
  const [providers, setProviders] = useState(initialProviders);
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<ProviderType>("OPENROUTER");
  const [busyId, setBusyId] = useState("");
  const [editing, setEditing] = useState<Provider | null>(null);
  const [displayName, setDisplayName] = useState<string>(choices.OPENROUTER.label);
  const [baseUrl, setBaseUrl] = useState<string>(choices.OPENROUTER.baseUrl);
  const [apiKey, setApiKey] = useState<string>("");
  const [chatModel, setChatModel] = useState<string>(choices.OPENROUTER.model);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  function openCreate() {
    setEditing(null);
    setType("OPENROUTER");
    setDisplayName(choices.OPENROUTER.label);
    setBaseUrl(choices.OPENROUTER.baseUrl);
    setApiKey("");
    setChatModel(choices.OPENROUTER.model);
    setAvailableModels([]);
    setNotice(null);
    setIsOpen(true);
  }

  function openEdit(provider: Provider) {
    setEditing(provider);
    setType(provider.type as ProviderType);
    setDisplayName(provider.displayName);
    setBaseUrl(provider.baseUrl ?? "");
    setApiKey("");
    setChatModel(provider.defaultChatModel ?? "");
    setAvailableModels([]);
    setNotice(null);
    setIsOpen(true);
  }

  function chooseType(nextType: ProviderType) {
    if (nextType === type) return;
    setDisplayName((current) =>
      current.trim() === choices[type].label ? choices[nextType].label : current,
    );
    setType(nextType);
    setBaseUrl(choices[nextType].baseUrl);
    setApiKey("");
    setChatModel(choices[nextType].model);
    setAvailableModels([]);
  }

  async function saveProvider(formData: FormData) {
    setBusyId(editing ? `edit:${editing.id}` : "create");
    setNotice(null);
    try {
      const response = await fetch(editing ? `/api/ai-providers/${editing.id}` : "/api/ai-providers", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          displayName: formData.get("displayName"),
          baseUrl,
          apiKey,
          defaultChatModel: chatModel,
          isActive: !editing && providers.length === 0,
        }),
      });
      const data = await readApiResponse<{ provider: Provider; message: string }>(response);
      if (!response.ok || !data.provider) {
        setNotice({ kind: "error", text: responseMessage(data.message, "Không thể lưu kết nối.") });
        return;
      }
      if (editing) {
        setProviders((current) =>
          current.map((item) =>
            item.id === editing.id ? { ...item, ...data.provider! } : item,
          ),
        );
      } else {
        setProviders((current) => [data.provider!, ...current.map((item) => ({ ...item, isActive: false }))]);
      }
      setNotice({
        kind: "ok",
        text: editing
          ? "Đã cập nhật kết nối. Hãy kiểm tra lại."
          : "Đã lưu kết nối. Hãy kiểm tra trước khi dùng.",
      });
      setIsOpen(false);
      setEditing(null);
    } catch {
      setNotice({ kind: "error", text: "Ứng dụng không phản hồi. Hãy thử lại." });
    } finally {
      setBusyId("");
    }
  }

  async function loadModels() {
    setBusyId("models");
    setNotice(null);
    try {
      const response = await fetch("/api/ai-providers/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: editing?.id, type, baseUrl, apiKey }),
      });
      const data = await readApiResponse<{ models: string[]; message: string }>(response);
      if (!response.ok || !data.models) {
        setNotice({ kind: "error", text: responseMessage(data.message, "Không thể tải danh sách model.") });
        return;
      }
      setAvailableModels(data.models);
      if (data.models.length && !data.models.includes(chatModel)) setChatModel(data.models[0]);
      setNotice({ kind: "ok", text: `Đã tải ${data.models.length} model.` });
    } catch {
      setNotice({ kind: "error", text: "Ứng dụng không phản hồi. Hãy thử lại." });
    } finally {
      setBusyId("");
    }
  }

  async function runAction(id: string, action: "test" | "activate" | "delete") {
    setBusyId(`${action}:${id}`);
    setNotice(null);
    try {
      const response = await fetch(action === "test" ? `/api/ai-providers/${id}/test` : `/api/ai-providers/${id}`, {
        method: action === "delete" ? "DELETE" : action === "activate" ? "PATCH" : "POST",
        ...(action === "activate"
          ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: true }) }
          : {}),
      });
      const data = await readApiResponse<{ message: string }>(response);
      if (!response.ok) {
        if (action === "test") {
          setProviders((items) => items.map((item) => (item.id === id ? { ...item, authStatus: "ERROR" } : item)));
        }
        setNotice({ kind: "error", text: responseMessage(data.message, "Thao tác không thành công.") });
        return;
      }
      if (action === "delete") setProviders((items) => items.filter((item) => item.id !== id));
      if (action === "activate") setProviders((items) => items.map((item) => ({ ...item, isActive: item.id === id })));
      if (action === "test") {
        setProviders((items) => items.map((item) => (item.id === id ? { ...item, authStatus: "CONNECTED" } : item)));
      }
      setNotice({ kind: "ok", text: responseMessage(data.message, "Thao tác thành công.") });
    } catch {
      setNotice({ kind: "error", text: "Ứng dụng không phản hồi. Hãy thử lại." });
    } finally {
      setBusyId("");
    }
  }

  const saving = busyId === "create" || busyId.startsWith("edit:");
  const currentChoice = choices[type];

  return (
    <>
      <div className="provider-toolbar">
        <div>
          <h2>Kết nối AI đã thêm</h2>
          <p>Kết nối mặc định được dùng để phân tích tài liệu và trả lời câu hỏi có dẫn nguồn.</p>
        </div>
        <button className="primary-button compact" onClick={openCreate} type="button">
          <Plus size={17} />
          Thêm kết nối AI
        </button>
      </div>

      {notice ? (
        <div className={`provider-notice ${notice.kind}`} role="status">
          {notice.kind === "ok" ? <Check size={17} /> : <CircleAlert size={17} />}
          <span>{notice.text}</span>
        </div>
      ) : null}

      {providers.length ? (
        <div className="provider-list">
          {providers.map((provider) => {
            const Icon = choices[provider.type as ProviderType]?.icon ?? Bot;
            const isBusy = busyId.endsWith(provider.id);
            return (
              <article className={`provider-card ${provider.isActive ? "active" : ""}`} key={provider.id}>
                <span className="provider-icon">
                  <Icon size={21} />
                </span>
                <div className="provider-main">
                  <div className="provider-title">
                    <strong>{provider.displayName}</strong>
                    {provider.isActive ? (
                      <span className="status-pill success">
                        <i />
                        Mặc định
                      </span>
                    ) : null}
                  </div>
                  <p>
                    {providerTypeLabel(provider.type)} · {provider.defaultChatModel}
                  </p>
                  <small>{provider.baseUrl}</small>
                </div>
                <span className={`connection-state ${provider.authStatus.toLowerCase()}`}>
                  {connectionLabel(provider.authStatus)}
                </span>
                <div className="provider-actions">
                  <button
                    aria-label="Chỉnh sửa provider"
                    className="icon-button"
                    disabled={isBusy}
                    onClick={() => openEdit(provider)}
                    title="Chỉnh sửa"
                    type="button"
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    aria-label="Kiểm tra kết nối"
                    className="icon-button"
                    disabled={isBusy}
                    onClick={() => runAction(provider.id, "test")}
                    title="Kiểm tra kết nối"
                    type="button"
                  >
                    {busyId === `test:${provider.id}` ? <LoaderCircle className="spin" size={18} /> : <TestTube2 size={18} />}
                  </button>
                  <button
                    aria-label="Đặt làm mặc định"
                    className="icon-button"
                    disabled={isBusy || provider.isActive}
                    onClick={() => runAction(provider.id, "activate")}
                    title="Đặt làm mặc định"
                    type="button"
                  >
                    <Radio size={18} />
                  </button>
                  <button
                    aria-label="Xóa provider"
                    className="icon-button danger-icon"
                    disabled={isBusy}
                    onClick={() => runAction(provider.id, "delete")}
                    title="Xóa"
                    type="button"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="provider-empty">
          <Bot size={28} />
          <strong>Chưa có kết nối AI</strong>
          <p>Thêm OpenRouter, Ollama hoặc Custom API để app có thể phân tích tài liệu.</p>
          <button className="primary-button compact" onClick={openCreate} type="button">
            <Plus size={17} />
            Thêm kết nối đầu tiên
          </button>
        </div>
      )}

      {isOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="provider-dialog" role="dialog">
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">Kết nối AI</p>
                <h2>{editing ? "Chỉnh sửa kết nối" : "Thêm kết nối AI"}</h2>
              </div>
              <button aria-label="Đóng" className="icon-button" onClick={() => setIsOpen(false)} type="button">
                <X size={19} />
              </button>
            </div>

            <div className="provider-choices">
              {(Object.keys(choices) as ProviderType[]).map((item) => {
                const ItemIcon = choices[item].icon;
                return (
                  <button
                    className={type === item ? "selected" : ""}
                    disabled={saving}
                    key={item}
                    onClick={() => chooseType(item)}
                    type="button"
                  >
                    <ItemIcon size={20} />
                    <span>
                      <strong>{choices[item].label}</strong>
                      <small>{choices[item].description}</small>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="provider-help">
              <strong>{currentChoice.label}</strong>
              <p>{currentChoice.hint}</p>
            </div>

            <form action={saveProvider} className="provider-form" key={`${type}:${editing?.id ?? "new"}`}>
              <label>
                Tên hiển thị
                <input
                  name="displayName"
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                  value={displayName}
                />
              </label>
              <label>
                Base URL
                <div className="provider-model-row">
                  <input
                    onChange={(event) => setBaseUrl(event.target.value)}
                    placeholder="https://api.example.com/v1"
                    required
                    value={baseUrl}
                  />
                  <button
                    aria-label="Tải danh sách model"
                    className="icon-button"
                    disabled={busyId === "models" || !baseUrl}
                    onClick={loadModels}
                    title="Tải danh sách model"
                    type="button"
                  >
                    {busyId === "models" ? <LoaderCircle className="spin" size={18} /> : <RefreshCw size={18} />}
                  </button>
                </div>
                <small>Bấm nút làm mới bên phải để thử tải model từ URL này.</small>
              </label>
              {type !== "OLLAMA" ? (
                <label>
                  API key
                  <input
                    autoComplete="off"
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder={editing?.hasApiKey ? "Để trống để giữ API key hiện tại" : "Dán API key vào đây"}
                    required={!editing?.hasApiKey}
                    type="password"
                    value={apiKey}
                  />
                  <small>API key được mã hóa trước khi lưu vào database.</small>
                </label>
              ) : null}
              <label>
                Chat model
                {availableModels.length ? (
                  <select onChange={(event) => setChatModel(event.target.value)} required value={chatModel}>
                    {availableModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input onChange={(event) => setChatModel(event.target.value)} placeholder="provider/model-id" required value={chatModel} />
                )}
              </label>
              <div className="dialog-actions">
                <button className="secondary-button" onClick={() => setIsOpen(false)} type="button">
                  Hủy
                </button>
                <button className="primary-button" disabled={saving} type="submit">
                  {saving ? <LoaderCircle className="spin" size={18} /> : editing ? <Pencil size={18} /> : <Plus size={18} />}
                  {saving ? "Đang lưu" : editing ? "Lưu thay đổi" : "Lưu kết nối"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
