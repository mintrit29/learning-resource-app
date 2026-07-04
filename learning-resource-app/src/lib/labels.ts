export const difficultyLabels: Record<string, string> = {
  BEGINNER: "Cơ bản",
  INTERMEDIATE: "Trung cấp",
  ADVANCED: "Nâng cao",
};

export function formatDifficulty(value?: string | null) {
  if (!value) return "Chưa rõ";
  return difficultyLabels[value] ?? value;
}
