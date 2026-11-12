import type { ModelSummary } from "@/lib/types";

/*
 * Discovery page state: filtering, sorting, paging, and its URL encoding.
 * All pure functions so they run identically on the server (first render from
 * searchParams) and the client (live filtering), and are easy to unit-test.
 */

export const CAPABILITY_FILTERS = [
  { key: "reasoning", label: "Reasoning" },
  { key: "tools", label: "Tool calling" },
  { key: "vision", label: "Vision" },
  { key: "open", label: "Open weights" },
  { key: "long", label: "1M+ context" },
  { key: "free", label: "Free" },
  { key: "current", label: "Hide deprecated" },
] as const;

export type CapabilityFilter = (typeof CAPABILITY_FILTERS)[number]["key"];

export const SORT_KEYS = ["name", "lab", "context", "input", "output", "released", "intelligence"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";
export type ViewMode = "table" | "cards";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export interface CatalogState {
  q: string;
  lab: string | null;
  caps: CapabilityFilter[];
  sort: SortKey;
  dir: SortDir;
  view: ViewMode;
  page: number;
  pageSize: PageSize;
}

export const PAGE_SIZE: PageSize = 10;

export const DEFAULT_CATALOG_STATE: CatalogState = {
  q: "",
  lab: null,
  caps: [],
  sort: "released",
  dir: "desc",
  view: "table",
  page: 1,
  pageSize: PAGE_SIZE,
};

/** What Next passes as `searchParams`, or a URLSearchParams on the client. */
export type RawSearchParams = Record<string, string | string[] | undefined> | URLSearchParams;

function first(params: RawSearchParams, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

const isOneOf = <T extends string>(list: readonly T[], value: string | undefined): value is T =>
  value !== undefined && (list as readonly string[]).includes(value);

/** Unknown or malformed values fall back to defaults instead of throwing. */
export function parseCatalogParams(params: RawSearchParams): CatalogState {
  const capKeys = CAPABILITY_FILTERS.map((c) => c.key);
  const caps = (first(params, "caps") ?? "")
    .split(",")
    .filter((c): c is CapabilityFilter => isOneOf(capKeys, c));
  const sort = first(params, "sort");
  const dir = first(params, "dir");
  const view = first(params, "view");
  const page = Number.parseInt(first(params, "page") ?? "", 10);
  const size = Number.parseInt(first(params, "size") ?? "", 10);
  const pageSize = (PAGE_SIZE_OPTIONS as readonly number[]).includes(size) ? (size as PageSize) : PAGE_SIZE;

  return {
    q: (first(params, "q") ?? "").slice(0, 100),
    lab: first(params, "lab") || null,
    caps: [...new Set(caps)],
    sort: isOneOf(SORT_KEYS, sort) ? sort : DEFAULT_CATALOG_STATE.sort,
    dir: dir === "asc" || dir === "desc" ? dir : DEFAULT_CATALOG_STATE.dir,
    view: view === "cards" ? "cards" : "table",
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize,
  };
}

/** Only non-default values are written, so a fresh page has a clean URL. */
export function serializeCatalogParams(state: CatalogState): string {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.lab) params.set("lab", state.lab);
  if (state.caps.length) params.set("caps", state.caps.join(","));
  if (state.sort !== DEFAULT_CATALOG_STATE.sort || state.dir !== DEFAULT_CATALOG_STATE.dir) {
    params.set("sort", state.sort);
    params.set("dir", state.dir);
  }
  if (state.view !== "table") params.set("view", state.view);
  if (state.page > 1) params.set("page", String(state.page));
  if (state.pageSize !== DEFAULT_CATALOG_STATE.pageSize) params.set("size", String(state.pageSize));
  return params.toString();
}

export const isFree = (m: ModelSummary) => m.pricing.input === 0 && m.pricing.output === 0;

function matchesCapability(m: ModelSummary, cap: CapabilityFilter): boolean {
  switch (cap) {
    case "reasoning":
      return m.capabilities.reasoning;
    case "tools":
      return m.capabilities.tools;
    case "vision":
      return m.capabilities.vision;
    case "open":
      return m.capabilities.openWeights;
    case "long":
      return (m.context ?? 0) >= 1_000_000;
    case "free":
      return isFree(m);
    case "current":
      return m.expiresAt === null;
  }
}

function sortValue(m: ModelSummary, key: SortKey): string | number | null {
  switch (key) {
    case "name":
      return m.name.toLowerCase();
    case "lab":
      return m.labName.toLowerCase();
    case "context":
      return m.context;
    case "input":
      return m.pricing.input;
    case "output":
      return m.pricing.output;
    case "released":
      return m.releasedAt;
    case "intelligence":
      return m.benchmarks.intelligence?.value ?? null;
  }
}

/** Sorts with missing values always last, whatever the direction. */
export function sortModels(models: ModelSummary[], key: SortKey, dir: SortDir): ModelSummary[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...models].sort((a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (va < vb) return -1 * sign;
    if (va > vb) return 1 * sign;
    return 0;
  });
}

export function filterModels(models: ModelSummary[], state: Pick<CatalogState, "q" | "lab" | "caps">) {
  const terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
  return models.filter((m) => {
    if (state.lab && m.lab !== state.lab) return false;
    if (!state.caps.every((cap) => matchesCapability(m, cap))) return false;
    // Every search word must appear somewhere in name, id or lab.
    const haystack = `${m.name} ${m.id} ${m.labName}`.toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
}

export function applyCatalog(models: ModelSummary[], state: CatalogState) {
  const filtered = sortModels(filterModels(models, state), state.sort, state.dir);
  const pageCount = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  const page = Math.min(state.page, pageCount); // an out-of-range page shows the last page
  return {
    rows: filtered.slice((page - 1) * state.pageSize, page * state.pageSize),
    total: filtered.length,
    page,
    pageCount,
  };
}

/** Labs with model counts, for the lab filter dropdown. */
export function listLabs(models: ModelSummary[]): Array<{ slug: string; name: string; count: number }> {
  const labs = new Map<string, { slug: string; name: string; count: number }>();
  for (const m of models) {
    const lab = labs.get(m.lab) ?? { slug: m.lab, name: m.labName, count: 0 };
    lab.count += 1;
    labs.set(m.lab, lab);
  }
  return [...labs.values()].sort((a, b) => a.name.localeCompare(b.name));
}
