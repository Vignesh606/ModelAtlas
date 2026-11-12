"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Link2, Plus, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { CompareStats } from "@/components/compare/compare-stats";
import { ComparisonMatrix, type ProviderMap } from "@/components/compare/comparison-matrix";
import { CostCalculator } from "@/components/cost-calculator";
import { ModelPicker } from "@/components/model-picker";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { setCompareItems, useCompareItems } from "@/lib/compare-store";
import { MAX_COMPARE, MIN_COMPARE, compareHref } from "@/lib/compare-url";
import { DEFAULT_USAGE, rankByCost, type Usage } from "@/lib/cost";
import type { ModelSummary } from "@/lib/types";
import { useDebouncedValue } from "@/lib/use-debounced-value";

interface Props {
  models: ModelSummary[];
  /** Valid ids parsed from ?models= on the server. */
  initialIds: string[];
  initialProviders: Record<string, string[]>;
  /** How many ids in the link were dropped (malformed, unknown, duplicate, over the limit). */
  skipped: number;
  suggestionIds: string[];
}

/*
 * State strategy: ?models= is the source of truth on load (parsed on the
 * server, so a pasted link renders fully, even in incognito). After that the
 * selection lives in React state and is written back to the URL with
 * history.replaceState, debounced so rapid edits produce one URL update and no
 * extra history entries or reloads.
 */
export function CompareView({ models, initialIds, initialProviders, skipped, suggestionIds }: Props) {
  const [ids, setIds] = useState<string[]>(initialIds);
  const [usage, setUsage] = useState<Usage>(DEFAULT_USAGE);
  const [providers, setProviders] = useState<ProviderMap>(initialProviders);
  const [showSkipped, setShowSkipped] = useState(skipped > 0);
  const trayItems = useCompareItems();
  const { show, toast } = useToast();

  const byId = useMemo(() => new Map(models.map((m) => [m.id, m])), [models]);
  const selected = useMemo(
    () => ids.map((id) => byId.get(id)).filter((m): m is ModelSummary => m !== undefined),
    [ids, byId],
  );
  // Memoized so dragging a slider only recomputes the (tiny) ranking.
  const ranking = useMemo(() => rankByCost(selected, usage), [selected, usage]);

  // Mirror the selection into the URL (debounced).
  const debouncedIds = useDebouncedValue(ids, 300);
  useEffect(() => {
    const target = compareHref(debouncedIds);
    if (`${window.location.pathname}${window.location.search}` !== target) {
      window.history.replaceState(null, "", target);
    }
  }, [debouncedIds]);

  // A shared link opened here becomes the compare tray too, so browsing on keeps it.
  // Both deps are stable for the component's lifetime, so this runs once on mount;
  // later changes are synced in the event handlers below.
  useEffect(() => {
    if (initialIds.length > 0) setCompareItems(toItems(initialIds, byId));
  }, [initialIds, byId]);

  // Fetch provider names for models added on the client (the server sent the
  // initial ones). The ref remembers what was requested so each id is fetched once.
  const requested = useRef(new Set(Object.keys(initialProviders)));
  useEffect(() => {
    for (const id of ids) {
      if (requested.current.has(id)) continue;
      requested.current.add(id);
      fetch(`/api/providers?model=${encodeURIComponent(id)}`)
        .then((res) => (res.ok ? (res.json() as Promise<{ providers: string[] }>) : Promise.reject(new Error(String(res.status)))))
        .then((data) => setProviders((p) => ({ ...p, [id]: data.providers })))
        .catch(() => setProviders((p) => ({ ...p, [id]: null })));
    }
  }, [ids]);

  const update = (next: string[]) => {
    setIds(next);
    setCompareItems(toItems(next, byId));
    setShowSkipped(false);
  };
  const add = (id: string) => {
    if (!ids.includes(id) && ids.length < MAX_COMPARE) update([...ids, id]);
  };
  const remove = (id: string) => update(ids.filter((i) => i !== id));

  const copyLink = async () => {
    // Built from state, not location, so it is correct even before the debounced URL update.
    const url = `${window.location.origin}${compareHref(ids)}`;
    try {
      await navigator.clipboard.writeText(url);
      show("Link copied to clipboard");
    } catch {
      show("Couldn't copy. Copy the address bar instead.");
    }
  };

  const full = ids.length >= MAX_COMPARE;
  const suggestions = suggestionIds.filter((id) => !ids.includes(id) && byId.has(id));
  const trayOnly = trayItems.filter((item) => !ids.includes(item.id) && byId.has(item.id));

  return (
    <div className="space-y-10">
      <CompareStats models={selected} ranking={ranking} />

      <section aria-labelledby="select-title" className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
        <SectionHeading
          id="select-title"
          eyebrow="Filter & select"
          title="Models to compare"
          actions={
            <Button variant="secondary" size="sm" onClick={copyLink} disabled={ids.length === 0}>
              <Link2 className="size-4" aria-hidden />
              Copy link
            </Button>
          }
        />
        <ModelPicker
          models={models}
          excludeIds={ids}
          onSelect={(m) => add(m.id)}
          label="Add a model to the comparison"
          disabled={full}
          disabledHint={`Maximum of ${MAX_COMPARE} models. Remove one to add another.`}
        />

        {showSkipped ? (
          <p role="status" className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-muted">
            {skipped === 1 ? "1 model in the link was" : `${skipped} models in the link were`} not recognised, duplicated or
            over the {MAX_COMPARE}-model limit, and {skipped === 1 ? "was" : "were"} skipped.
            <button type="button" onClick={() => setShowSkipped(false)} aria-label="Dismiss" className="rounded text-muted hover:text-fg">
              <X className="size-4" aria-hidden />
            </button>
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">
            Active comparison <span className="font-mono text-muted tabular-nums">({ids.length}/{MAX_COMPARE})</span>
          </p>
          {ids.length > 0 ? (
            <button type="button" onClick={() => update([])} className="rounded text-xs text-muted transition-colors hover:text-fg">
              Clear selection
            </button>
          ) : null}
        </div>
        {selected.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {selected.map((m) => (
              <li key={m.id} className="flex items-center gap-2 rounded-lg border border-border bg-bg py-1 pr-1 pl-1.5">
                <BrandLogo labName={m.labName} size="sm" />
                <span className="text-sm font-medium">{m.name}</span>
                <span className="text-xs text-muted">({m.labName})</span>
                <button
                  type="button"
                  onClick={() => remove(m.id)}
                  aria-label={`Remove ${m.name} from comparison`}
                  className="inline-flex size-6 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {!full && (suggestions.length > 0 || trayOnly.length > 0) ? (
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-xs font-medium text-muted">Quick add</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {/* Tray models first, then the brief's sample models; de-duplicated, max 6. */}
              {[...new Set([...trayOnly.map((t) => t.id), ...suggestions])]
                .slice(0, 6)
                .map((id) => {
                  const m = byId.get(id);
                  if (!m) return null;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => add(id)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-bg px-3 text-xs transition-colors duration-150 hover:border-border-strong hover:bg-surface-2"
                      >
                        <Plus className="size-3.5" aria-hidden />
                        <span className="font-medium">{m.name}</span>
                        <span className="text-muted">· {m.labName}</span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>
        ) : null}
      </section>

      {selected.length < MIN_COMPARE ? (
        <div className="rounded-2xl border border-dashed border-border-strong px-6 py-16 text-center">
          <p className="font-medium">Select at least 2 models to compare technical specs and cost.</p>
          <p className="mt-1 text-sm text-muted">Search above, or use a quick-add suggestion.</p>
        </div>
      ) : (
        <>
          <section aria-labelledby="cost-title">
            <SectionHeading
              id="cost-title"
              eyebrow="Cost estimator"
              title="Monthly bill at your usage"
              description="Adjust monthly token volumes; every figure on this page updates instantly."
            />
            <CostCalculator models={selected} usage={usage} onUsageChange={setUsage} ranking={ranking} />
          </section>

          <section aria-labelledby="matrix-title">
            <SectionHeading
              id="matrix-title"
              eyebrow="Full matrix"
              title="Technical comparison"
              description="Specifications, pricing, benchmarks and providers side by side."
            />
            <ComparisonMatrix models={selected} providers={providers} ranking={ranking} onRemove={remove} />
          </section>
        </>
      )}
      {toast}
    </div>
  );
}

function toItems(ids: string[], byId: Map<string, ModelSummary>) {
  return ids.flatMap((id) => {
    const m = byId.get(id);
    return m ? [{ id: m.id, name: m.name, labName: m.labName }] : [];
  });
}
