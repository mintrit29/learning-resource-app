export function normalizeTagName(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("vi")
    .replace(/\bc\s*\+\s*\+/giu, " cpp ")
    .replace(/\bc\s*#/giu, " c sharp ")
    .replace(/\.net\b/giu, " dotnet ")
    .replace(/&/g, " and ")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/đ/g, "d")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
