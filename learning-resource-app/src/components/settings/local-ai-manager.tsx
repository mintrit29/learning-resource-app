"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CircleAlert,
  Cpu,
  Download,
  ExternalLink,
  Gauge,
  HardDrive,
  LoaderCircle,
  MemoryStick,
  RefreshCw,
  Sparkles,
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

type LocalModel = {
  id: string;
  aliases: string[];
  name: string;
  tier: "light" | "balanced" | "quality";
  tierLabel: string;
  downloadBytes: number;
  minimumMemoryBytes: number;
  fit: "recommended" | "compatible" | "demanding" | "insufficient-storage";
  fitLabel: string;
  reason: string;
};

type LocalAiStatus = {
  system: {
    cpuModel: string;
    cpuThreads: number;
    totalMemoryBytes: number;
    freeMemoryBytes: number;
    freeDiskBytes: number | null;
    maxGpuMemoryBytes: number | null;
    gpus: Array<{ name: string; memoryBytes: number | null }>;
  };
  recommendations: LocalModel[];
  ollama: {
    connected: boolean;
    connectionMessage: string;
    baseUrl: string;
    providerId: string | null;
    installedModels: Array<{
      name: string;
      sizeBytes: number | null;
      modifiedAt: string | null;
      parameterSize: string | null;
      quantization: string | null;
    }>;
  };
};

type DownloadState = {
  model: string;
  progress: number | null;
  status: string;
};

type Notice = { kind: "ok" | "error"; text: string };

function formatBytes(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return "Không xác định";
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(digits)} GB`;
  return `${Math.max(0, value / 1024 ** 2).toFixed(0)} MB`;
}

function shortCpuName(value: string) {
  return value.replace(/\(R\)|\(TM\)/gi, "").replace(/\s+/g, " ").trim();
}

async function responseData<T extends object>(response: Response): Promise<Partial<T>> {
  try {
    const value = await response.json() as unknown;
    return value && typeof value === "object" ? value as Partial<T> : {};
  } catch {
    return {};
  }
}

async function fetchLocalAiStatus(providerId?: string) {
  const query = providerId ? `?providerId=${encodeURIComponent(providerId)}` : "";
  const response = await fetch(`/api/local-ai/status${query}`, { cache: "no-store" });
  const data = await responseData<LocalAiStatus & { message: string }>(response);
  if (!response.ok || !data.system || !data.recommendations || !data.ollama) {
    throw new Error(typeof data.message === "string" ? data.message : "Không thể đọc cấu hình máy.");
  }
  return data as LocalAiStatus;
}

export function LocalAiManager({
  provider,
  hasAnyProvider,
  onProviderReady,
  onNotice,
}: {
  provider: Provider | null;
  hasAnyProvider: boolean;
  onProviderReady: (provider: Provider) => void;
  onNotice: (notice: Notice) => void;
}) {
  const [status, setStatus] = useState<LocalAiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState("");
  const [download, setDownload] = useState<DownloadState | null>(null);

  function applyStatus(nextStatus: LocalAiStatus) {
    setStatus(nextStatus);
    setSelectedModel((current) => {
      if (current && nextStatus.recommendations.some((model) => model.id === current)) return current;
      const saved = provider?.defaultChatModel;
      const savedModel = saved
        ? nextStatus.recommendations.find((model) => model.id === saved || model.aliases.includes(saved))
        : null;
      if (savedModel) return savedModel.id;
      return nextStatus.recommendations.find((model) => model.fit === "recommended")?.id
        ?? nextStatus.recommendations[0]?.id
        ?? "";
    });
  }

  async function loadStatus(quiet = false) {
    if (!quiet) setLoading(true);
    try {
      applyStatus(await fetchLocalAiStatus(provider?.id));
    } catch (error) {
      if (!quiet) {
        onNotice({
          kind: "error",
          text: error instanceof Error ? error.message : "Không thể đọc cấu hình máy.",
        });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let current = true;
    fetchLocalAiStatus(provider?.id).then((nextStatus) => {
      if (!current) return;
      setStatus(nextStatus);
      setSelectedModel((selectedModel) => {
        if (selectedModel && nextStatus.recommendations.some((model) => model.id === selectedModel)) {
          return selectedModel;
        }
        const saved = provider?.defaultChatModel;
        const savedModel = saved
          ? nextStatus.recommendations.find((model) => model.id === saved || model.aliases.includes(saved))
          : null;
        if (savedModel) return savedModel.id;
        return nextStatus.recommendations.find((model) => model.fit === "recommended")?.id
          ?? nextStatus.recommendations[0]?.id
          ?? "";
      });
      setLoading(false);
    }).catch((error: unknown) => {
      if (!current) return;
      setLoading(false);
      onNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Không thể đọc cấu hình máy.",
      });
    });
    return () => {
      current = false;
    };
  }, [onNotice, provider]);

  const installedNames = useMemo(
    () => new Set(status?.ollama.installedModels.map((model) => model.name) ?? []),
    [status?.ollama.installedModels],
  );
  const selected = status?.recommendations.find((model) => model.id === selectedModel) ?? null;
  const selectedInstalledName = selected
    ? [selected.id, ...selected.aliases].find((name) => installedNames.has(name)) ?? null
    : null;
  const selectedInstalled = Boolean(selectedInstalledName);
  const selectedIsActive = Boolean(
    selected
    && provider?.isActive
    && [selected.id, ...selected.aliases].includes(provider.defaultChatModel ?? "")
    && provider.authStatus === "CONNECTED",
  );

  async function saveAndActivateModel(model: string, baseUrl: string) {
    const payload = {
      type: "OLLAMA",
      displayName: provider?.displayName || "Ollama trên thiết bị",
      baseUrl,
      apiKey: "",
      defaultChatModel: model,
      isActive: true,
    };
    const saveResponse = await fetch(provider ? `/api/ai-providers/${provider.id}` : "/api/ai-providers", {
      method: provider ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const saved = await responseData<{ provider: Provider; message: string }>(saveResponse);
    if (!saveResponse.ok || !saved.provider) {
      throw new Error(typeof saved.message === "string" ? saved.message : "Không thể lưu kết nối Ollama.");
    }

    let readyProvider = { ...saved.provider, isActive: true };
    if (provider && !provider.isActive) {
      const activateResponse = await fetch(`/api/ai-providers/${provider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (!activateResponse.ok) {
        const activation = await responseData<{ message: string }>(activateResponse);
        throw new Error(typeof activation.message === "string" ? activation.message : "Không thể đặt Ollama làm mặc định.");
      }
    }

    const testResponse = await fetch(`/api/ai-providers/${readyProvider.id}/test`, { method: "POST" });
    const tested = await responseData<{ message: string }>(testResponse);
    readyProvider = { ...readyProvider, authStatus: testResponse.ok ? "CONNECTED" : "ERROR" };
    onProviderReady(readyProvider);
    if (!testResponse.ok) {
      throw new Error(typeof tested.message === "string"
        ? `Đã chọn model nhưng kiểm tra thất bại: ${tested.message}`
        : "Đã chọn model nhưng chưa thể kiểm tra kết nối.");
    }
  }

  async function pullSelectedModel() {
    if (!status || !selected) return;
    if (!status.ollama.connected) {
      onNotice({ kind: "error", text: "Hãy cài đặt và mở Ollama trước khi tải model." });
      return;
    }
    if (!selectedInstalled && selected.fit === "insufficient-storage") {
      onNotice({ kind: "error", text: "Ổ đĩa không còn đủ dung lượng an toàn cho model này." });
      return;
    }

    setDownload({ model: selected.id, progress: selectedInstalled ? 100 : 0, status: selectedInstalled ? "Đang cấu hình" : "Đang chuẩn bị tải" });
    try {
      if (!selectedInstalled) {
        const response = await fetch("/api/local-ai/pull", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providerId: status.ollama.providerId ?? undefined, model: selected.id }),
        });
        if (!response.ok || !response.body) {
          const error = await responseData<{ message: string }>(response);
          throw new Error(typeof error.message === "string" ? error.message : "Không thể tải model.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let pending = "";
        while (true) {
          const { done, value } = await reader.read();
          pending += decoder.decode(value, { stream: !done });
          const lines = pending.split("\n");
          pending = done ? "" : lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const update = JSON.parse(line) as { status?: string; completed?: number; total?: number; error?: string };
            if (update.error) throw new Error(update.error);
            const progress = update.total && typeof update.completed === "number"
              ? Math.min(100, Math.round((update.completed / update.total) * 100))
              : null;
            setDownload({
              model: selected.id,
              progress,
              status: update.status === "success" ? "Đã tải xong" : update.status || "Đang tải model",
            });
          }
          if (done) break;
        }
      }

      setDownload({ model: selected.id, progress: 100, status: "Đang kiểm tra model" });
      await saveAndActivateModel(selectedInstalledName ?? selected.id, status.ollama.baseUrl);
      await loadStatus(true);
      onNotice({ kind: "ok", text: `${selected.name} đã sẵn sàng và được đặt làm model mặc định.` });
    } catch (error) {
      onNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Không thể tải và sử dụng model.",
      });
    } finally {
      setDownload(null);
    }
  }

  if (loading && !status) {
    return (
      <div className="local-ai-loading">
        <LoaderCircle className="spin" size={22} />
        <span>Đang đọc cấu hình máy và kiểm tra Ollama...</span>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="local-ai-unavailable">
        <CircleAlert size={22} />
        <span>Chưa thể đọc cấu hình Local AI.</span>
        <button className="secondary-button compact" onClick={() => void loadStatus()} type="button">Thử lại</button>
      </div>
    );
  }

  const gpu = status.system.gpus[0];
  const buttonDisabled = Boolean(
    download
    || !selected
    || !status.ollama.connected
    || (!selectedInstalled && selected?.fit === "insufficient-storage")
    || selectedIsActive,
  );

  return (
    <div className="local-ai-manager">
      <div className="local-system-card">
        <div className="local-system-heading">
          <span className="provider-icon"><Gauge size={21} /></span>
          <div>
            <strong>Tự động gợi ý cho máy này</strong>
            <p>ScholarFlow dành lại bộ nhớ cho ứng dụng và hệ điều hành trước khi đề xuất model.</p>
          </div>
          <button aria-label="Kiểm tra lại cấu hình máy" className="icon-button" disabled={loading || Boolean(download)} onClick={() => void loadStatus()} title="Kiểm tra lại" type="button">
            <RefreshCw className={loading ? "spin" : ""} size={18} />
          </button>
        </div>
        <div className="local-system-specs">
          <span title={status.system.cpuModel}><Cpu size={16} />{shortCpuName(status.system.cpuModel)} · {status.system.cpuThreads} luồng</span>
          <span><MemoryStick size={16} />RAM {formatBytes(status.system.totalMemoryBytes, 0)}</span>
          <span><HardDrive size={16} />Trống {formatBytes(status.system.freeDiskBytes, 0)}</span>
          <span title={gpu?.name || "Không nhận diện được GPU"}><Gauge size={16} />{gpu ? `${gpu.name}${gpu.memoryBytes ? ` · ${formatBytes(gpu.memoryBytes, 0)}` : ""}` : "Chưa nhận diện GPU"}</span>
        </div>
      </div>

      <div className="local-model-grid">
        {status.recommendations.map((model) => {
          const installed = [model.id, ...model.aliases].some((name) => installedNames.has(name));
          const selectedCard = selectedModel === model.id;
          return (
            <button
              className={`local-model-card ${selectedCard ? "selected" : ""} ${model.fit}`}
              disabled={Boolean(download)}
              key={model.id}
              onClick={() => setSelectedModel(model.id)}
              type="button"
            >
              <span className="local-model-title">
                <strong>{model.name}</strong>
                {model.fit === "recommended" ? <Sparkles size={16} /> : null}
              </span>
              <span className="local-model-meta">{model.tierLabel} · tải khoảng {formatBytes(model.downloadBytes)}</span>
              <span className={`local-fit-badge ${model.fit}`}>{installed ? "Đã tải" : model.fitLabel}</span>
              <small>{model.reason}</small>
            </button>
          );
        })}
      </div>

      <div className={`ollama-status ${status.ollama.connected ? "connected" : "offline"}`}>
        {status.ollama.connected ? <Check size={18} /> : <CircleAlert size={18} />}
        <div>
          <strong>{status.ollama.connected ? "Ollama đã sẵn sàng" : "Chưa phát hiện Ollama"}</strong>
          <small>{status.ollama.connectionMessage} {status.ollama.connected ? `${status.ollama.installedModels.length} model đã cài.` : ""}</small>
        </div>
        {!status.ollama.connected ? (
          <a className="secondary-button compact" href="https://ollama.com/download/windows" rel="noreferrer" target="_blank">
            <ExternalLink size={16} /> Tải Ollama
          </a>
        ) : null}
      </div>

      {download ? (
        <div aria-live="polite" className="local-download-progress">
          <div>
            <span>{download.status}</span>
            <strong>{download.progress === null ? "..." : `${download.progress}%`}</strong>
          </div>
          <span className="progress-track"><i style={{ width: `${download.progress ?? 5}%` }} /></span>
          <small>Không tắt Ollama trong khi model đang được tải.</small>
        </div>
      ) : null}

      <div className="local-model-actions">
        <div>
          <strong>{selected?.name ?? "Chọn một model"}</strong>
          <small>{selectedIsActive ? "Model này đang được dùng mặc định." : selected?.reason}</small>
        </div>
        <button className="primary-button" disabled={buttonDisabled} onClick={() => void pullSelectedModel()} type="button">
          {download ? <LoaderCircle className="spin" size={18} /> : selectedInstalled ? <Check size={18} /> : <Download size={18} />}
          {download
            ? "Đang xử lý"
            : selectedIsActive
              ? "Đang sử dụng"
              : selectedInstalled
                ? "Sử dụng model này"
                : "Tải xuống và sử dụng"}
        </button>
      </div>

      {!hasAnyProvider && status.ollama.connected ? (
        <p className="local-first-provider-note">Model bạn chọn sẽ tự động trở thành kết nối AI mặc định đầu tiên.</p>
      ) : null}
    </div>
  );
}
