"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutGrid, Search, Table2 } from "lucide-react";
import { FilterPills } from "@/components/catalog/filter-pills";
import { ModelsCards } from "@/components/catalog/models-cards";
import { ModelsTable } from "@/components/catalog/models-table";
import { Pagination } from "@/components/catalog/pagination";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  DEFAULT_CATALOG_STATE,
  applyCatalog,
  serializeCatalogParams,
  type CapabilityFilter,
  type CatalogState,
  type SortKey,
} from "@/lib/catalog";
import type { ModelSummary } from "@/lib/types";
import { useDebouncedValue } from "@/lib/use-debounced-value";

interface Props {
  models: ModelSummary[];
  labs: Array<{ slug: string; name: string; count: number }>;
  /** Parsed from the URL on the server, so the first paint already matches the link. */
  initialState: CatalogState;
}

/*
 * State strategy: the URL is the serialized form of the filters. The server
 * parses it for the first render; after that this component owns the state and
 * mirrors it back with history.replaceState (no navigation, no server round
 * trip, no extra history entries). Filtering ~470 models in memory takes well
 * under a millisecond, so it runs on every change without a server call.
 */
export function Catalog({ models, labs, initialState }: Props) {
  const [state, setState] = useState<Omit<CatalogState, "q">>(initialState);
  const [query, setQuery] = useState(initialState.q);
  const debouncedQuery = useDebouncedValue(query, 250);
  const topRef = useRef<HTMLDivElement>(null);

  const effective: CatalogState = useMemo(() => ({ ...state, q: debouncedQuery }), [state, debouncedQuery]);
  const result = useMemo(() => applyCatalog(models, effective), [models, effective]);

  useEffect(() => {
    const qs = serializeCatalogParams({ ...effective, page: result.page });
    const search = qs ? `?${qs}` : ""; // location.search is "" when there are no params
    if (search !== window.location.search) {
      window.history.replaceState(null, "", `${window.location.pathname}${search}`);
    }
  }, [effective, result.page]);

  // Any filter change returns to page 1.
  const update = (patch: Partial<Omit<CatalogState, "q">>) => setState((s) => ({ ...s, page: 1, ...patch }));

  const toggleCap = (cap: CapabilityFilter) =>
    update({ caps: state.caps.includes(cap) ? state.caps.filter((c) => c !== cap) : [...state.caps, cap] });

  // Clicking the active column flips direction. A new column starts in its most
  // useful direction: A-Z for text, cheapest first for prices, biggest/newest first otherwise.
  const ASC_FIRST: SortKey[] = ["name", "lab", "input", "output"];
  const sortBy = (key: SortKey) =>
    update({
      sort: key,
      dir: state.sort === key ? (state.dir === "asc" ? "desc" : "asc") : ASC_FIRST.includes(key) ? "asc" : "desc",
    });

  const goToPage = (page: number) => {
    setState((s) => ({ ...s, page }));
    topRef.current?.scrollIntoView({ block: "start" });
  };

  const resetFilters = () => {
    setQuery("");
    setState((s) => ({ ...DEFAULT_CATALOG_STATE, view: s.view }));
  };

  const hasFilters = query !== "" || state.lab !== null || state.caps.length > 0;

  return (
    <div ref={topRef} className="scroll-mt-20 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search models</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setState((s) => ({ ...s, page: 1 }));
            }}
            placeholder="Search by model, lab or id..."
            maxLength={100}
            className="h-10 w-full rounded-lg border border-border bg-bg pr-3 pl-9 text-sm placeholder:text-muted hover:border-border-strong"
          />
        </label>
        <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-bg px-3 text-sm hover:border-border-strong sm:w-64">
          <span className="text-muted">Lab</span>
          <select
            value={state.lab ?? ""}
            onChange={(e) => update({ lab: e.target.value || null })}
            className="min-w-0 flex-1 bg-transparent font-medium focus-visible:outline-none"
          >
            <option value="">All labs ({labs.length})</option>
            {labs.map((lab) => (
              <option key={lab.slug} value={lab.slug}>
                {lab.name} ({lab.count})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <FilterPills active={state.caps} onToggle={toggleCap} />
        <div className="flex items-center gap-3">
          {/* aria-live: screen readers hear the new count after each filter change. */}
          <p aria-live="polite" className="font-mono text-xs text-muted tabular-nums">
            {result.total} {result.total === 1 ? "model" : "models"}
          </p>
          <div role="group" aria-label="View" className="flex rounded-lg border border-border bg-bg p-0.5">
            {(
              [
                { view: "table", label: "Table", Icon: Table2 },
                { view: "cards", label: "Cards", Icon: LayoutGrid },
              ] as const
            ).map(({ view, label, Icon }) => (
              <button
                key={view}
                type="button"
                aria-pressed={state.view === view}
                onClick={() => setState((s) => ({ ...s, view }))}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors duration-150",
                  state.view === view ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {result.total === 0 ? (
        <div className="py-16 text-center">
          <p className="font-medium">No models match these filters.</p>
          <p className="mt-1 text-sm text-muted">Try a shorter search or remove a filter.</p>
          {hasFilters ? (
            <Button variant="secondary" size="sm" className="mt-4" onClick={resetFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : state.view === "table" ? (
        <ModelsTable rows={result.rows} sort={state.sort} dir={state.dir} onSort={sortBy} />
      ) : (
        <ModelsCards rows={result.rows} />
      )}

      {result.rows.some((m) => Object.values(m.benchmarks).some((s) => s?.source === "sample")) ? (
        <p className="mt-3 text-xs text-muted">
          † Sample benchmark value from the assessment brief. Other scores: Artificial Analysis, via OpenRouter.
        </p>
      ) : null}

      <Pagination page={result.page} pageCount={result.pageCount} onChange={goToPage} />
    </div>
  );
}
