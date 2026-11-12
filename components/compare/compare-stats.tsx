import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { MAX_COMPARE, MIN_COMPARE } from "@/lib/compare-url";
import { formatUsd, type CostRanking } from "@/lib/cost";
import { formatPrice } from "@/lib/format";
import type { ModelSummary } from "@/lib/types";

/** Summary cards above the comparison (selection count, lowest rates, cheapest bill). */
export function CompareStats({ models, ranking }: { models: ModelSummary[]; ranking: CostRanking }) {
  const cheapest = (key: "input" | "output") =>
    models
      .filter((m) => m.pricing[key] !== null)
      .sort((a, b) => (a.pricing[key] ?? 0) - (b.pricing[key] ?? 0))[0];

  const lowestIn = cheapest("input");
  const lowestOut = cheapest("output");
  const best = models.find((m) => m.id === ranking.bestId);
  const runnerUp = models.find((m) => m.id === ranking.runnerUpId);

  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Selected models"
        badge={models.length >= MIN_COMPARE ? <Badge tone="neutral">Valid set</Badge> : null}
        value={
          <>
            {models.length}
            <span className="text-base text-muted"> / {MAX_COMPARE}</span>
          </>
        }
        note={models.map((m) => m.name).join(", ") || "None yet"}
      />
      <StatCard
        label="Lowest input rate"
        value={lowestIn ? <PerMillion value={formatPrice(lowestIn.pricing.input)} /> : "-"}
        note={lowestIn ? `${lowestIn.name} (${lowestIn.labName})` : "No pricing yet"}
      />
      <StatCard
        label="Lowest output rate"
        value={lowestOut ? <PerMillion value={formatPrice(lowestOut.pricing.output)} /> : "-"}
        note={lowestOut ? `${lowestOut.name} (${lowestOut.labName})` : "No pricing yet"}
      />
      <StatCard
        label="Cheapest monthly bill"
        value={
          best ? (
            <>
              {formatUsd(ranking.costs[best.id] ?? null)}
              <span className="text-base text-muted">/mo</span>
            </>
          ) : (
            "-"
          )
        }
        note={
          best && runnerUp && ranking.savings !== null
            ? `${best.name}: saves ${formatUsd(ranking.savings)} vs ${runnerUp.name}`
            : ranking.tie
              ? "Tied for lowest bill"
              : best
                ? best.name
                : "Select models with known pricing"
        }
      />
    </dl>
  );
}

function PerMillion({ value }: { value: string }) {
  return (
    <>
      {value}
      {value !== "Free" ? <span className="text-base text-muted">/1M</span> : null}
    </>
  );
}

function StatCard({ label, value, note, badge }: { label: string; value: ReactNode; note: string; badge?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
      <dt className="flex items-center justify-between gap-2 text-sm text-muted">
        {label}
        {badge}
      </dt>
      <dd className="mt-2 font-mono text-3xl tabular-nums">{value}</dd>
      <dd className="mt-2 truncate text-xs text-muted" title={note}>
        {note}
      </dd>
    </div>
  );
}
