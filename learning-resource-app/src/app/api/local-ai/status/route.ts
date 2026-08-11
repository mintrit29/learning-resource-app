import { execFile } from "node:child_process";
import { statfs } from "node:fs/promises";
import { cpus, freemem, platform, totalmem } from "node:os";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { recommendLocalModels } from "@/lib/ai/local-model-catalog";
import { DEFAULT_OLLAMA_BASE_URL, isLoopbackUrl, localOllamaBaseUrl } from "@/lib/ai/local-ollama";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

type GpuInfo = {
  name: string;
  memoryBytes: number | null;
};

type OllamaTag = {
  name?: string;
  model?: string;
  size?: number;
  modified_at?: string;
  details?: {
    parameter_size?: string;
    quantization_level?: string;
  };
};

function finitePositiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parseWindowsGpuOutput(stdout: string): GpuInfo[] {
  const parsed = JSON.parse(stdout.trim()) as unknown;
  const entries = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as { Name?: unknown; AdapterRAM?: unknown };
    const name = typeof item.Name === "string" ? item.Name.trim() : "";
    if (!name) return [];
    return [{ name, memoryBytes: finitePositiveNumber(item.AdapterRAM) }];
  });
}

async function runPowerShellJson(command: string) {
  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    command,
  ], { timeout: 4_000, windowsHide: true, maxBuffer: 64 * 1024 });
  return stdout;
}

async function readWindowsGpus(): Promise<GpuInfo[]> {
  if (platform() !== "win32") return [];
  try {
    const command = [
      "$ErrorActionPreference='Stop'",
      "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM | ConvertTo-Json -Compress",
    ].join("; ");
    return parseWindowsGpuOutput(await runPowerShellJson(command));
  } catch {
    try {
      const registryCommand = [
        "$items = Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Video' -ErrorAction Stop",
        "$items | ForEach-Object { $p = Get-ItemProperty ($_.PSPath + '\\0000') -ErrorAction SilentlyContinue; if ($p.DriverDesc) { [pscustomobject]@{ Name = $p.DriverDesc; AdapterRAM = $p.HardwareInformationMemorySize } } } | ConvertTo-Json -Compress",
      ].join("; ");
      return parseWindowsGpuOutput(await runPowerShellJson(registryCommand));
    } catch {
      return [];
    }
  }
}

async function readFreeDiskBytes() {
  try {
    const target = process.env.LOCALAPPDATA || process.cwd();
    const details = await statfs(target);
    return details.bavail * details.bsize;
  } catch {
    return null;
  }
}

async function readOllamaModels(baseUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
    const data = await response.json() as { models?: OllamaTag[] };
    return (data.models ?? []).flatMap((model) => {
      const name = model.name || model.model;
      if (!name) return [];
      return [{
        name,
        sizeBytes: finitePositiveNumber(model.size),
        modifiedAt: model.modified_at ?? null,
        parameterSize: model.details?.parameter_size ?? null,
        quantization: model.details?.quantization_level ?? null,
      }];
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Bạn cần đăng nhập" }, { status: 401 });

  const providerId = new URL(request.url).searchParams.get("providerId");
  const savedProviders = await db.aiProvider.findMany({
    where: { userId: session.user.id, type: "OLLAMA" },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });
  const selectedProvider = providerId
    ? savedProviders.find((provider) => provider.id === providerId && isLoopbackUrl(provider.baseUrl))
    : savedProviders.find((provider) => isLoopbackUrl(provider.baseUrl));
  const baseUrl = localOllamaBaseUrl(selectedProvider?.baseUrl ?? DEFAULT_OLLAMA_BASE_URL);

  const [gpus, freeDiskBytes] = await Promise.all([readWindowsGpus(), readFreeDiskBytes()]);
  const system = {
    platform: platform(),
    cpuModel: cpus()[0]?.model?.trim() || "Không xác định",
    cpuThreads: cpus().length,
    totalMemoryBytes: totalmem(),
    freeMemoryBytes: freemem(),
    freeDiskBytes,
    gpus,
    maxGpuMemoryBytes: gpus.reduce<number | null>((largest, gpu) => {
      if (!gpu.memoryBytes) return largest;
      return largest === null ? gpu.memoryBytes : Math.max(largest, gpu.memoryBytes);
    }, null),
  };

  let connected = false;
  let installedModels: Awaited<ReturnType<typeof readOllamaModels>> = [];
  let connectionMessage = "Chưa phát hiện Ollama. Hãy cài đặt và mở Ollama trước khi tải model.";
  try {
    installedModels = await readOllamaModels(baseUrl);
    connected = true;
    connectionMessage = "Ollama đang hoạt động trên máy.";
  } catch {
    // Trạng thái không kết nối được trả về cho giao diện thay vì biến thành lỗi API.
  }

  return NextResponse.json({
    system,
    recommendations: recommendLocalModels(system),
    ollama: {
      connected,
      connectionMessage,
      baseUrl,
      providerId: selectedProvider?.id ?? null,
      installedModels,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
