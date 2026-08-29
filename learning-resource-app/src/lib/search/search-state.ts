export type SearchStatus = "OK" | "NO_RELEVANT_RESULTS" | "EMPTY_LIBRARY";
export type SearchFilters = {
  topic: string;
  difficulty: "" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  fileType: "" | "PDF" | "PPTX" | "DOCX" | "EPUB" | "IMAGE" | "AUDIO" | "XMIND";
};
export type SavedSearchState<Result> = {
  query: string;
  filters: SearchFilters;
  appliedFilters?: SearchFilters;
  results: Result[];
  status?: SearchStatus | null;
};

export const EMPTY_FILTERS: SearchFilters = { topic: "", difficulty: "", fileType: "" };

// Editing invalidates the completed result immediately, including persisted state.
export function createSearchDraft<Result>(query: string, filters: SearchFilters): SavedSearchState<Result> {
  return { query, filters, appliedFilters: filters, results: [], status: null };
}

export function searchSignature(query: string, filters: SearchFilters) {
  return JSON.stringify([query.trim().slice(0, 500), filters.topic, filters.difficulty, filters.fileType]);
}

export function restoreSearchState<Result>(saved: SavedSearchState<Result>) {
  const filters = saved.filters ?? EMPTY_FILTERS;
  const applied = saved.appliedFilters ?? filters;
  const complete = saved.query.trim().length >= 2
    && Array.isArray(saved.results)
    && (saved.results.length > 0 || Boolean(saved.status))
    && searchSignature(saved.query, filters) === searchSignature(saved.query, applied);
  return {
    ...saved,
    filters,
    appliedFilters: applied,
    results: complete ? saved.results : [],
    status: complete ? saved.status ?? "OK" as SearchStatus : null,
    searchedQuery: complete ? saved.query : "",
    signature: complete ? searchSignature(saved.query, filters) : "",
  };
}
