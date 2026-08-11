export const GIB = 1024 ** 3;

export type LocalSystemProfile = {
  totalMemoryBytes: number;
  freeMemoryBytes: number;
  freeDiskBytes: number | null;
  maxGpuMemoryBytes: number | null;
};

export type LocalModelFit = "recommended" | "compatible" | "demanding" | "insufficient-storage";

export type LocalModelRecommendation = LocalModelDefinition & {
  fit: LocalModelFit;
  fitLabel: string;
  reason: string;
};

export type LocalModelDefinition = {
  id: string;
  aliases: readonly string[];
  name: string;
  tier: "light" | "balanced" | "quality";
  tierLabel: string;
  downloadBytes: number;
  minimumMemoryBytes: number;
};

export const LOCAL_MODEL_CATALOG: readonly LocalModelDefinition[] = [
  {
    id: "qwen3:1.7b",
    aliases: ["qwen3:1.7b-q4_K_M"],
    name: "Qwen3 1.7B",
    tier: "light",
    tierLabel: "Nhẹ",
    downloadBytes: 1.4 * GIB,
    minimumMemoryBytes: 6 * GIB,
  },
  {
    id: "qwen3:4b-instruct",
    aliases: ["qwen3:4b-instruct-2507-q4_K_M"],
    name: "Qwen3 4B Instruct",
    tier: "balanced",
    tierLabel: "Cân bằng",
    downloadBytes: 2.5 * GIB,
    minimumMemoryBytes: 10 * GIB,
  },
  {
    id: "qwen3:8b",
    aliases: ["qwen3:latest", "qwen3:8b-q4_K_M"],
    name: "Qwen3 8B",
    tier: "quality",
    tierLabel: "Chất lượng cao",
    downloadBytes: 5.2 * GIB,
    minimumMemoryBytes: 18 * GIB,
  },
] as const;

function canStoreModel(profile: LocalSystemProfile, model: LocalModelDefinition) {
  if (profile.freeDiskBytes === null) return true;
  const downloadHeadroom = Math.max(2 * GIB, model.downloadBytes * 0.35);
  return profile.freeDiskBytes >= model.downloadBytes + downloadHeadroom;
}

export function recommendedLocalModelId(profile: LocalSystemProfile) {
  const gpuMemory = profile.maxGpuMemoryBytes ?? 0;
  const candidates = LOCAL_MODEL_CATALOG.filter((model) => canStoreModel(profile, model));

  const qualityReady = profile.totalMemoryBytes >= 24 * GIB
    || (profile.totalMemoryBytes >= 16 * GIB && gpuMemory >= 7 * GIB);
  if (qualityReady && candidates.some((model) => model.id === "qwen3:8b")) return "qwen3:8b";

  const balancedReady = profile.totalMemoryBytes >= 12 * GIB
    || (profile.totalMemoryBytes >= 10 * GIB && gpuMemory >= 3 * GIB);
  if (balancedReady && candidates.some((model) => model.id === "qwen3:4b-instruct")) {
    return "qwen3:4b-instruct";
  }

  return candidates.find((model) => model.id === "qwen3:1.7b")?.id
    ?? candidates[0]?.id
    ?? "qwen3:1.7b";
}

export function recommendLocalModels(profile: LocalSystemProfile): LocalModelRecommendation[] {
  const recommendedId = recommendedLocalModelId(profile);
  return LOCAL_MODEL_CATALOG.map((model) => {
    if (!canStoreModel(profile, model)) {
      return {
        ...model,
        fit: "insufficient-storage",
        fitLabel: "Thiếu dung lượng",
        reason: "Ổ đĩa không còn đủ chỗ trống an toàn để tải model này.",
      };
    }
    if (model.id === recommendedId) {
      return {
        ...model,
        fit: "recommended",
        fitLabel: "Đề xuất cho máy này",
        reason: "Cân bằng tốt giữa tốc độ, bộ nhớ và chất lượng trên cấu hình hiện tại.",
      };
    }
    if (profile.totalMemoryBytes >= model.minimumMemoryBytes) {
      return {
        ...model,
        fit: "compatible",
        fitLabel: "Có thể sử dụng",
        reason: model.tier === "light"
          ? "Nhẹ hơn model đề xuất và phù hợp khi cần ưu tiên tốc độ."
          : "Máy đủ bộ nhớ, nhưng tốc độ thực tế còn phụ thuộc GPU và độ dài tài liệu.",
      };
    }
    return {
      ...model,
      fit: "demanding",
      fitLabel: "Không khuyến nghị",
      reason: "Model có thể chạy chậm hoặc làm máy thiếu bộ nhớ.",
    };
  });
}

export function isAllowedLocalModel(model: string) {
  return LOCAL_MODEL_CATALOG.some((candidate) => candidate.id === model);
}
