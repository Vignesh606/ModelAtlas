"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Trophy } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatContext, formatPrice } from "@/lib/format";
import { BENCHMARK_METRICS, rankModels, type BenchmarkKey, type RankedModel } from "@/lib/rankings";
import { modelHref } from "@/lib/routes";
import type { ModelSummary } from "@/lib/types";

const TOP_COUNT = 10;
const BENCHMARK_CARD_COUNT = 5;

export function RankingsSection({ models }: { models: ModelSummary[] }) {
  const [metric, setMetric] = useState<BenchmarkKey>("intelligence");
  const [showAll, setShowAll] = useState(false);
  const [showPercent, setShowPercent] = useState(false);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);

  const ranked = useMemo(() => rankModels(models, metric), [models, metric]);
  const maxScore = useMemo(() => Math.max(100, ...ranked.map((r) => r.score)), [ranked]);
  const topTen = ranked.slice(0, TOP_COUNT);
  const rest = ranked.slice(TOP_COUNT);

  // Scroll-driven progress (0 -> 1) for the benchmarks section below the rankings.
  const benchmarkRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const el = benchmarkRef.current;
    if (!el) return;

    const reducedMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      const frame = requestAnimationFrame(() => setScrollProgress(1));
      return () => cancelAnimationFrame(frame);
    }

    let rafId = 0;
    const updateProgress = () => {
      rafId = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      // Starts filling when top enters bottom 92% of viewport; reaches 100% by 35%.
      const start = vh * 0.92;
      const end = vh * 0.35;
      const raw = (start - rect.top) / (start - end);
      const clamped = Math.min(1, Math.max(0, raw));
      setScrollProgress(clamped);
    };

    const onScroll = () => {
      if (!rafId) rafId = requestAnimationFrame(updateProgress);
    };

    // Initial measurement
    rafId = requestAnimationFrame(updateProgress);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const benchmarkLeaderboards = useMemo(
    () =>
      BENCHMARK_METRICS.map((m) => {
        const list = rankModels(models, m.key);
        const top = list.slice(0, BENCHMARK_CARD_COUNT);
        const max = Math.max(100, ...top.map((r) => r.score));
        return { ...m, top, max, total: list.length };
      }),
    [models],
  );

  if (ranked.length === 0) return null;

  const benchmarksVisible = scrollProgress > 0.05;

  return (
    <div className="space-y-8">
      {/* Top 10 Rankings Card */}
      <div className="rounded-2xl border border-border bg-surface shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2">
            <Trophy className="size-4 text-accent" aria-hidden />
            <span className="text-sm font-medium">
              Top {Math.min(TOP_COUNT, ranked.length)} of {ranked.length} ranked models
            </span>
          </div>
          <div role="tablist" aria-label="Ranking benchmark" className="flex flex-wrap gap-1 rounded-lg border border-border bg-bg p-1">
            {BENCHMARK_METRICS.map((m) => {
              const active = metric === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMetric(m.key)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200",
                    active ? "bg-surface text-fg shadow-xs" : "text-muted hover:text-fg",
                  )}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <ol className="divide-y divide-border">
          {topTen.map((entry) => (
            <RankingRow key={entry.model.id} entry={entry} maxScore={maxScore} />
          ))}
        </ol>

        {rest.length > 0 ? (
          <>
            <div
              id="more-rankings"
              aria-hidden={!showAll}
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-500 ease-out",
                showAll ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <ol start={TOP_COUNT + 1} className="divide-y divide-border border-t border-border">
                  {rest.map((entry) => (
                    <RankingRow key={entry.model.id} entry={entry} maxScore={maxScore} tabIndex={showAll ? undefined : -1} />
                  ))}
                </ol>
              </div>
            </div>

            <div className="flex justify-center border-t border-border px-4 py-3">
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={showAll}
                aria-controls="more-rankings"
                onClick={() => setShowAll((prev) => !prev)}
                className="gap-1.5"
              >
                {showAll ? `Hide ${rest.length} other models` : `Show ${rest.length} more ranked models`}
                <ChevronDown
                  className={cn("size-4 transition-transform duration-300 ease-out", showAll && "rotate-180")}
                  aria-hidden
                />
              </Button>
            </div>
          </>
        ) : null}
      </div>

      {/* Benchmarks Breakdown (below rankings, bars react dynamically to scroll) */}
      <div ref={benchmarkRef} aria-labelledby="benchmarks-subtitle" className="space-y-4">
        <div
          className={cn(
            "flex flex-wrap items-end justify-between gap-3 transition-all duration-500 ease-out",
            benchmarksVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          )}
        >
          <div>
            <p className="text-xs font-semibold tracking-wider text-muted uppercase">Benchmarks</p>
            <h3 id="benchmarks-subtitle" className="font-display text-xl tracking-tight sm:text-2xl">
              Score breakdown across evaluations
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              Scroll to animate bars · Hover or click a model to highlight across categories
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted tabular-nums">
              {Math.round(scrollProgress * 100)}% revealed
            </span>
            <div role="group" aria-label="Benchmark display mode" className="flex rounded-lg border border-border bg-bg p-0.5">
              <button
                type="button"
                aria-pressed={!showPercent}
                onClick={() => setShowPercent(false)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150",
                  !showPercent ? "bg-surface text-fg shadow-xs" : "text-muted hover:text-fg",
                )}
              >
                Score
              </button>
              <button
                type="button"
                aria-pressed={showPercent}
                onClick={() => setShowPercent(true)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150",
                  showPercent ? "bg-surface text-fg shadow-xs" : "text-muted hover:text-fg",
                )}
              >
                Percent
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {benchmarkLeaderboards.map((board, cardIdx) => (
            <section
              key={board.key}
              aria-label={`${board.label} benchmark`}
              style={{ transitionDelay: benchmarksVisible ? `${cardIdx * 70}ms` : "0ms" }}
              className={cn(
                "rounded-2xl border border-border bg-surface p-4 shadow-card transition-all duration-500 ease-out sm:p-5",
                benchmarksVisible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="text-sm font-semibold">{board.label}</h4>
                <span className="font-mono text-xs text-muted tabular-nums">{board.total} scored</span>
              </div>
              <p className="mt-0.5 text-xs text-muted">{board.description}</p>

              <ul className="mt-4 space-y-3">
                {board.top.map((entry) => {
                  const targetPct = Math.min(100, Math.max(0, (entry.score / board.max) * 100));
                  const livePct = targetPct * scrollProgress;
                  const liveScore = entry.score * scrollProgress;
                  const isHighlighted = activeModelId === entry.model.id;
                  const isDimmed = activeModelId !== null && !isHighlighted;

                  return (
                    <li
                      key={entry.model.id}
                      onMouseEnter={() => setActiveModelId(entry.model.id)}
                      onMouseLeave={() => setActiveModelId((id) => (id === entry.model.id ? null : id))}
                      onClick={() => setActiveModelId((id) => (id === entry.model.id ? null : entry.model.id))}
                      className={cn(
                        "cursor-pointer space-y-1.5 rounded-lg p-1.5 -mx-1.5 transition-all duration-200",
                        isHighlighted && "bg-surface-2 ring-1 ring-accent/40",
                        isDimmed && "opacity-45",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <Link
                          href={modelHref(entry.model.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="flex min-w-0 items-center gap-2 font-medium hover:underline"
                        >
                          <span className="w-4 shrink-0 font-mono text-muted tabular-nums">{entry.rank}.</span>
                          <BrandLogo labName={entry.model.labName} size="sm" />
                          <span className="truncate">{entry.model.name}</span>
                        </Link>
                        <span className="shrink-0 font-mono tabular-nums">
                          {showPercent ? `${Math.round(livePct)}%` : liveScore.toFixed(1)}
                        </span>
                      </div>
                      <div aria-hidden className="h-2 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className={cn(
                            "h-full rounded-full transition-[width,background-color] duration-150 ease-out",
                            isHighlighted ? "bg-fg" : "bg-accent",
                          )}
                          style={{ width: `${livePct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function RankingRow({
  entry,
  maxScore,
  tabIndex,
}: {
  entry: RankedModel;
  maxScore: number;
  tabIndex?: number;
}) {
  const { rank, model, score, source } = entry;
  const pct = Math.min(100, Math.max(0, (score / maxScore) * 100));

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors duration-150 hover:bg-surface-2/60 sm:flex-nowrap sm:px-5">
      <span
        className={cn(
          "inline-flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold tabular-nums",
          rank === 1
            ? "bg-accent text-primary-fg"
            : rank <= 3
              ? "bg-accent-soft text-accent"
              : "bg-surface-2 text-muted",
        )}
      >
        {rank}
      </span>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <BrandLogo labName={model.labName} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link href={modelHref(model.id)} tabIndex={tabIndex} className="truncate text-sm font-medium hover:underline">
              {model.name}
            </Link>
            {source === "sample" ? <Badge tone="outline">Sample</Badge> : null}
          </div>
          <p className="truncate text-xs text-muted">
            {model.labName} · {formatContext(model.context)} ctx · {formatPrice(model.pricing.input)}/1M in
          </p>
        </div>
      </div>

      <div className="flex w-full items-center gap-3 sm:w-48 sm:shrink-0">
        <div aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className={cn("h-full rounded-full transition-[width] duration-500 ease-out", rank <= 3 ? "bg-accent" : "bg-fg/75")}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-11 text-right font-mono text-sm font-medium tabular-nums">{score.toFixed(1)}</span>
      </div>
    </li>
  );
}
