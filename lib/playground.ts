import { isFree } from "@/lib/catalog";
import { toSummary } from "@/lib/summary";
import type { Model, ModelSummary } from "@/lib/types";

/** What the playground needs per model: the summary plus the parameters it accepts. */
export type ChatModel = ModelSummary & { supportedParameters: string[] };

export function toChatModel(model: Model): ChatModel {
  return { ...toSummary(model), supportedParameters: model.supportedParameters };
}

/** Models the playground can call: live on OpenRouter and able to output text. */
export function isChatModel(model: Model): boolean {
  return model.source === "live" && model.output.includes("text");
}

/**
 * Free models verified (2026-11-12) to answer ordinary chat requests. Some free
 * models carry restrictions the catalog doesn't expose (one top-scoring model
 * only accepts "agentic harness" traffic and returns 403), so ranking alone
 * isn't a safe default. `openrouter/free` routes to whichever free model is
 * available, the most resilient last resort.
 */
export const DEFAULT_FREE_MODELS = [
  "nvidia/nemotron-3.5-super-vl:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "openrouter/free",
] as const;

/**
 * Default model: the first preferred id that exists in the catalog (env
 * override first, then DEFAULT_FREE_MODELS), otherwise the free model with the
 * best intelligence score (newest as a tie-break), so a first-time visitor can
 * chat at no cost. Free models change often, hence the fallback chain.
 */
export function pickDefaultModel<T extends ModelSummary>(
  models: T[],
  preferredIds: ReadonlyArray<string | undefined> = DEFAULT_FREE_MODELS,
): T | undefined {
  for (const id of preferredIds) {
    const preferred = id ? models.find((m) => m.id === id) : undefined;
    if (preferred) return preferred;
  }

  const free = models.filter(isFree);
  const pool = free.length ? free : models;
  return [...pool].sort((a, b) => {
    const scoreDiff = (b.benchmarks.intelligence?.value ?? -1) - (a.benchmarks.intelligence?.value ?? -1);
    if (scoreDiff !== 0) return scoreDiff;
    return (b.releasedAt ?? "").localeCompare(a.releasedAt ?? "");
  })[0];
}
