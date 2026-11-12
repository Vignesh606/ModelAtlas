import type { ModelSummary } from "@/lib/types";

export const BENCHMARK_METRICS = [
  { key: "intelligence", label: "Intelligence", description: "Artificial Analysis Intelligence Index" },
  { key: "coding", label: "Coding", description: "Coding & software engineering benchmark score" },
  { key: "agentic", label: "Agentic", description: "Tool use & multi-step agentic reasoning score" },
] as const;

export type BenchmarkKey = (typeof BENCHMARK_METRICS)[number]["key"];

export interface RankedModel {
  rank: number;
  model: ModelSummary;
  score: number;
  source: "artificial-analysis" | "sample";
}

/**
 * Filters to models with a score for `metric` and sorts highest-first.
 * Ties break by intelligence score, then release date, then name.
 */
export function rankModels(models: readonly ModelSummary[], metric: BenchmarkKey): RankedModel[] {
  const scored = models.filter((m) => m.benchmarks[metric] !== null);
  const sorted = [...scored].sort((a, b) => {
    const sa = a.benchmarks[metric]!.value;
    const sb = b.benchmarks[metric]!.value;
    if (sb !== sa) return sb - sa;

    const ia = a.benchmarks.intelligence?.value ?? -1;
    const ib = b.benchmarks.intelligence?.value ?? -1;
    if (ib !== ia) return ib - ia;

    const dateDiff = (b.releasedAt ?? "").localeCompare(a.releasedAt ?? "");
    if (dateDiff !== 0) return dateDiff;

    return a.name.localeCompare(b.name);
  });

  return sorted.map((model, index) => ({
    rank: index + 1,
    model,
    score: model.benchmarks[metric]!.value,
    source: model.benchmarks[metric]!.source,
  }));
}
