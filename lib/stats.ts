import type { Model } from "@/lib/types";

/** Aggregates for the home page stats card. Computed on the server from the catalog. */

export interface MonthBucket {
  /** "2026-10" */
  key: string;
  /** "Oct 2026" */
  label: string;
  count: number;
}

export interface CatalogStats {
  models: number;
  labs: number;
  free: number;
  withBenchmarks: number;
  releasesByMonth: MonthBucket[];
  releasesTotal: number;
  /** Share of models (0-1) with each capability. */
  coverage: Array<{ label: string; share: number }>;
}

const monthLabel = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/** The last 12 calendar months ending with the month of `now`, oldest first. */
export function lastTwelveMonths(now: Date): Array<{ key: string; label: string }> {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - i), 1));
    return { key: d.toISOString().slice(0, 7), label: monthLabel.format(d) };
  });
}

export function computeStats(models: Model[], now: Date): CatalogStats {
  const months = lastTwelveMonths(now);
  const counts = new Map(months.map((m) => [m.key, 0]));
  for (const m of models) {
    const key = m.releasedAt?.slice(0, 7);
    if (key && counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const releasesByMonth = months.map((m) => ({ ...m, count: counts.get(m.key) ?? 0 }));

  const share = (predicate: (m: Model) => boolean) =>
    models.length ? models.filter(predicate).length / models.length : 0;

  return {
    models: models.length,
    labs: new Set(models.map((m) => m.lab)).size,
    free: models.filter((m) => m.pricing.input === 0 && m.pricing.output === 0).length,
    withBenchmarks: models.filter((m) => m.benchmarks.intelligence).length,
    releasesByMonth,
    releasesTotal: releasesByMonth.reduce((sum, m) => sum + m.count, 0),
    coverage: [
      { label: "Tool calling", share: share((m) => m.capabilities.tools) },
      { label: "Reasoning", share: share((m) => m.capabilities.reasoning) },
      { label: "Vision input", share: share((m) => m.capabilities.vision) },
      { label: "Open weights", share: share((m) => m.capabilities.openWeights) },
    ],
  };
}
