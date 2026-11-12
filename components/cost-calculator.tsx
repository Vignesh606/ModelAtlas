"use client";

import { useId, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import {
  DEFAULT_USAGE,
  MAX_TOKENS,
  SLIDER_STEPS,
  USAGE_PRESETS,
  formatTokensShort,
  formatUsd,
  sliderToTokens,
  tokensToSlider,
  type CostRanking,
  type Usage,
} from "@/lib/cost";
import { formatInteger } from "@/lib/format";
import type { ModelSummary } from "@/lib/types";

/*
 * Presentational: usage state and the memoized ranking live in the parent
 * (CompareView), because the matrix and stat cards show the same numbers.
 * Dragging a slider only updates one number in state; the ranking is a few
 * multiplications, so the UI recalculates on every input event with no lag.
 */
export function CostCalculator({
  models,
  usage,
  onUsageChange,
  ranking,
}: {
  models: ModelSummary[];
  usage: Usage;
  onUsageChange: (usage: Usage) => void;
  ranking: CostRanking;
}) {
  const isDefault = usage.inputTokens === DEFAULT_USAGE.inputTokens && usage.outputTokens === DEFAULT_USAGE.outputTokens;
  const runnerUp = models.find((m) => m.id === ranking.runnerUpId);
  const knownCosts = Object.values(ranking.costs).filter((c): c is number => c !== null);
  const lowestCost = knownCosts.length ? Math.min(...knownCosts) : null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Usage presets">
        <span className="mr-1 text-xs font-medium text-muted">Presets</span>
        {USAGE_PRESETS.map((preset) => {
          const active =
            usage.inputTokens === preset.usage.inputTokens && usage.outputTokens === preset.usage.outputTokens;
          return (
            <button
              key={preset.key}
              type="button"
              aria-pressed={active}
              title={preset.description}
              onClick={() => onUsageChange(preset.usage)}
              className={cn(
                "h-8 rounded-lg border px-3 text-xs font-medium transition-colors duration-150",
                active
                  ? "border-primary bg-primary text-primary-fg"
                  : "border-border bg-bg hover:border-border-strong hover:bg-surface-2",
              )}
            >
              {preset.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onUsageChange(DEFAULT_USAGE)}
          disabled={isDefault}
          className="h-8 rounded-lg px-3 text-xs font-medium text-muted transition-colors duration-150 hover:text-fg disabled:opacity-40"
        >
          Reset
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        {USAGE_PRESETS.find(
          (p) => p.usage.inputTokens === usage.inputTokens && p.usage.outputTokens === usage.outputTokens,
        )?.description ?? "Custom monthly volume. Drag the sliders or type exact numbers."}
      </p>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <TokenControl
          label="Monthly input (prompt) tokens"
          value={usage.inputTokens}
          onChange={(inputTokens) => onUsageChange({ ...usage, inputTokens })}
        />
        <TokenControl
          label="Monthly output (completion) tokens"
          value={usage.outputTokens}
          onChange={(outputTokens) => onUsageChange({ ...usage, outputTokens })}
        />
      </div>

      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {models.map((m) => {
          const cost = ranking.costs[m.id] ?? null;
          const best = ranking.bestId === m.id;
          return (
            <li
              key={m.id}
              className={cn(
                "rounded-xl border bg-bg p-4 transition-colors duration-150",
                best ? "border-accent" : "border-border",
              )}
            >
              <div className="flex items-center gap-2">
                <BrandLogo labName={m.labName} size="sm" />
                <span className="truncate text-sm font-medium">{m.name}</span>
              </div>
              <p className="mt-3 font-mono text-2xl tabular-nums">
                {cost === null ? "-" : formatUsd(cost)}
                {cost !== null ? <span className="text-sm text-muted">/mo</span> : null}
              </p>
              <div className="mt-2 min-h-5 text-xs text-muted">
                {cost === null ? (
                  "Pricing unavailable"
                ) : best ? (
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="accent">Best value</Badge>
                    {ranking.savings !== null && runnerUp
                      ? `Saves ${formatUsd(ranking.savings)}/mo vs ${runnerUp.name}`
                      : "Only model with known pricing"}
                  </span>
                ) : ranking.tie && cost === lowestCost ? (
                  "Tied for lowest bill"
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-xs text-muted">
        Monthly cost = (input tokens / 1M) × input price + (output tokens / 1M) × output price, using each model&apos;s
        default OpenRouter price. Caching, batch discounts and long-context surcharges are not included.
      </p>
    </div>
  );
}

function TokenControl({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const id = useId();
  // While typing, keep the raw text (so the field can be empty or mid-edit);
  // otherwise show the value from props (which sliders and presets change).
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={`${id}-number`} className="text-sm font-medium">
          {label}
        </label>
        <span className="font-mono text-sm tabular-nums">{formatTokensShort(value)}</span>
      </div>
      <input
        type="range"
        aria-label={`${label} slider`}
        aria-valuetext={`${formatInteger(value)} tokens`}
        min={0}
        max={SLIDER_STEPS}
        step={1}
        value={tokensToSlider(value)}
        onChange={(e) => onChange(sliderToTokens(Number(e.target.value)))}
        className="mt-3 w-full accent-[var(--fg)]"
      />
      <div className="mt-1 flex justify-between text-[11px] text-muted" aria-hidden>
        <span>100K</span>
        <span>10M</span>
        <span>1B</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          id={`${id}-number`}
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_TOKENS}
          step={1000}
          value={draft ?? String(value)}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            const parsed = Number(raw);
            if (raw !== "" && Number.isFinite(parsed)) {
              onChange(Math.min(MAX_TOKENS, Math.max(0, Math.round(parsed))));
            }
          }}
          onBlur={() => setDraft(null)}
          className="h-9 w-full rounded-lg border border-border bg-bg px-3 font-mono text-sm tabular-nums hover:border-border-strong"
        />
        <span className="shrink-0 text-xs text-muted">tokens / mo</span>
      </div>
    </div>
  );
}
