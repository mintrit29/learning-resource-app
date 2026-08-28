const FILTER_KEYS = ["q", "topic", "difficulty", "fileType", "status"] as const;

export function libraryHref(filters: Partial<Record<(typeof FILTER_KEYS)[number], string | undefined>>) {
  const query = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key]?.trim();
    if (value) query.set(key, value);
  }
  return `/documents${query.size ? `?${query}` : ""}`;
}

// Never trust a returnTo URL supplied by a renderer or an external link.
export function libraryReturnHref(returnTo: string | undefined, documentId: string) {
  if (!returnTo || returnTo.length > 8_192) return "/documents";
  try {
    const url = new URL(returnTo, "http://scholarflow.local");
    if (url.origin !== "http://scholarflow.local" || url.pathname !== "/documents") return "/documents";
    const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, url.searchParams.get(key) ?? undefined]));
    return `${libraryHref(filters)}#document-${encodeURIComponent(documentId)}`;
  } catch {
    return "/documents";
  }
}
