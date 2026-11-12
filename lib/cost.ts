import type { Pricing } from "@/lib/types";

/*
 * Cost estimator maths. Pure functions, unit-tested, shared by the calculator,
 * the comparison matrix and (later) the playground's cost projection.
 *
 * Monthly cost = (inputTokens / 1M) * inputPrice + (outputTokens / 1M) * outputPrice
 * with prices in USD per 1M tokens.
 */

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export const DEFAULT_USAGE: Usage = { inputTokens: 5_000_000, outputTokens: 1_000_000 };

/** Upper bound for typed values: guards against absurd input without limiting real use. */
export const MAX_TOKENS = 10_000_000_000;

/** Returns null when either price is unknown, since a partial estimate would mislead. */
export function monthlyCost(pricing: Pick<Pricing, "input" | "output">, usage: Usage): number | null {
  if (pricing.input === null || pricing.output === null) return null;
  return (usage.inputTokens / 1_000_000) * pricing.input + (usage.outputTokens / 1_000_000) * pricing.output;
}

export interface CostRanking {
  costs: Record<string, number | null>;
  /** Cheapest model, or null if no prices are known or the cheapest is tied. */
  bestId: string | null;
  /** Second cheapest, the model the savings are measured against. */
  runnerUpId: string | null;
  /** Monthly savings of best vs runner-up (null when there is no runner-up). */
  savings: number | null;
  tie: boolean;
}

export function rankByCost(
  models: ReadonlyArray<{ id: string; pricing: Pick<Pricing, "input" | "output"> }>,
  usage: Usage,
): CostRanking {
  const costs: Record<string, number | null> = {};
  for (const m of models) costs[m.id] = monthlyCost(m.pricing, usage);

  const priced = models
    .map((m) => ({ id: m.id, cost: costs[m.id] }))
    .filter((entry): entry is { id: string; cost: number } => typeof entry.cost === "number")
    .sort((a, b) => a.cost - b.cost);

  const [best, runnerUp] = priced;
  if (!best) return { costs, bestId: null, runnerUpId: null, savings: null, tie: false };
  if (!runnerUp) return { costs, bestId: best.id, runnerUpId: null, savings: null, tie: false };

  // Compare in cents so float noise can't break or invent a tie.
  const tie = Math.round(best.cost * 100) === Math.round(runnerUp.cost * 100);
  return {
    costs,
    bestId: tie ? null : best.id,
    runnerUpId: tie ? null : runnerUp.id,
    savings: tie ? null : runnerUp.cost - best.cost,
    tie,
  };
}

/**
 * Ids holding the lowest value in a matrix row. Empty unless at least two
 * values are known and they differ: a "lowest" badge on every cell means nothing.
 */
export function lowestIds(entries: ReadonlyArray<{ id: string; value: number | null }>): Set<string> {
  const known = entries.filter((e): e is { id: string; value: number } => e.value !== null);
  if (known.length < 2) return new Set();
  const values = known.map((e) => e.value);
  const min = Math.min(...values);
  if (min === Math.max(...values)) return new Set();
  return new Set(known.filter((e) => e.value === min).map((e) => e.id));
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Monthly cost display: "$12.40", "$1,234.00", "<$0.01", "$0.00". */
export function formatUsd(value: number | null): string {
  if (value === null) return "-";
  if (value > 0 && value < 0.01) return "<$0.01";
  return usd.format(value);
}

/** 5_000_000 -> "5M", 1_250_000 -> "1.25M", 750_000 -> "750K". */
export function formatTokensShort(tokens: number): string {
  if (tokens >= 1_000_000_000) return `${Number((tokens / 1_000_000_000).toFixed(2))}B`;
  if (tokens >= 1_000_000) return `${Number((tokens / 1_000_000).toFixed(2))}M`;
  if (tokens >= 1_000) return `${Number((tokens / 1_000).toFixed(1))}K`;
  return String(tokens);
}

/*
 * Sliders use a logarithmic scale: token volumes span 100K to 1B, and on a
 * linear track the default 5M would sit at 0.5%, impossible to adjust.
 * Positions are integers 0..SLIDER_STEPS.
 */
export const SLIDER_MIN = 100_000;
export const SLIDER_MAX = 1_000_000_000;
export const SLIDER_STEPS = 1000;

const LOG_RANGE = Math.log10(SLIDER_MAX / SLIDER_MIN);

export function tokensToSlider(tokens: number): number {
  if (tokens <= SLIDER_MIN) return 0;
  if (tokens >= SLIDER_MAX) return SLIDER_STEPS;
  return Math.round((Math.log10(tokens / SLIDER_MIN) / LOG_RANGE) * SLIDER_STEPS);
}

/** Rounded to 2 significant figures so dragging produces tidy values (5,000,000 not 5,011,872). */
export function sliderToTokens(position: number): number {
  const raw = SLIDER_MIN * 10 ** ((position / SLIDER_STEPS) * LOG_RANGE);
  return Number(raw.toPrecision(2));
}

/** Realistic monthly volumes; the description states the assumption behind each. */
export const USAGE_PRESETS = [
  {
    key: "chatbot",
    label: "Chatbot",
    description: "10K conversations, ~1K prompt + 400 reply tokens each",
    usage: { inputTokens: 10_000_000, outputTokens: 4_000_000 },
  },
  {
    key: "rag",
    label: "RAG",
    description: "20K queries with ~3K tokens of retrieved context, short answers",
    usage: { inputTokens: 60_000_000, outputTokens: 3_000_000 },
  },
  {
    key: "agent",
    label: "Code agent",
    description: "2K agent tasks, each re-reading ~100K tokens of code and tool output",
    usage: { inputTokens: 200_000_000, outputTokens: 10_000_000 },
  },
] as const satisfies ReadonlyArray<{ key: string; label: string; description: string; usage: Usage }>;
