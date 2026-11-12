import Link from "next/link";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ScoreValue } from "@/components/catalog/model-badges";
import { Badge } from "@/components/ui/badge";
import { formatUsd, lowestIds, type CostRanking } from "@/lib/cost";
import { formatContext, formatDate, formatPrice } from "@/lib/format";
import { modelHref } from "@/lib/routes";
import type { ModelSummary, Pricing } from "@/lib/types";

/** Provider names per model id; `undefined` = still loading, `null` = failed. */
export type ProviderMap = Record<string, string[] | null | undefined>;

const MAX_PROVIDER_BADGES = 6;

/*
 * Side-by-side table. On narrow screens it scrolls horizontally: the label
 * column is sticky, columns snap into place (scroll-snap), and scroll padding
 * equal to the label width keeps snapped columns from hiding under it.
 */
export function ComparisonMatrix({
  models,
  providers,
  ranking,
  onRemove,
}: {
  models: ModelSummary[];
  providers: ProviderMap;
  ranking: CostRanking;
  onRemove: (id: string) => void;
}) {
  // Ids with the lowest price in each pricing row (empty when there is no real winner).
  const lowest = (key: keyof Pricing) => lowestIds(models.map((m) => ({ id: m.id, value: m.pricing[key] })));
  const lowestInput = lowest("input");
  const lowestOutput = lowest("output");
  const lowestCacheRead = lowest("cacheRead");

  const sections: Array<{ title: string; rows: Array<{ label: string; cell: (m: ModelSummary) => ReactNode }> }> = [
    {
      title: "Specifications",
      rows: [
        { label: "Context window", cell: (m) => <span className="font-mono tabular-nums">{formatContext(m.context)}</span> },
        { label: "Max output", cell: (m) => <span className="font-mono tabular-nums">{formatContext(m.maxOutput)}</span> },
        { label: "Input modalities", cell: (m) => <Modalities values={m.input} /> },
        { label: "Output modalities", cell: (m) => <Modalities values={m.output} /> },
      ],
    },
    {
      title: "Pricing (USD per 1M tokens)",
      rows: [
        { label: "Input", cell: (m) => <PriceCell value={m.pricing.input} lowest={lowestInput.has(m.id)} /> },
        { label: "Output", cell: (m) => <PriceCell value={m.pricing.output} lowest={lowestOutput.has(m.id)} /> },
        { label: "Cache read", cell: (m) => <PriceCell value={m.pricing.cacheRead} lowest={lowestCacheRead.has(m.id)} /> },
      ],
    },
    {
      title: "Estimated monthly bill",
      rows: [
        {
          label: "At current usage",
          cell: (m) => {
            const cost = ranking.costs[m.id] ?? null;
            return (
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="font-mono tabular-nums">{cost === null ? "-" : `${formatUsd(cost)}/mo`}</span>
                {ranking.bestId === m.id ? <Badge tone="accent">Best value</Badge> : null}
              </span>
            );
          },
        },
      ],
    },
    {
      title: "Benchmarks",
      rows: [
        { label: "Intelligence", cell: (m) => <span className="font-mono tabular-nums"><ScoreValue score={m.benchmarks.intelligence} /></span> },
        { label: "Coding", cell: (m) => <span className="font-mono tabular-nums"><ScoreValue score={m.benchmarks.coding} /></span> },
        { label: "Agentic", cell: (m) => <span className="font-mono tabular-nums"><ScoreValue score={m.benchmarks.agentic} /></span> },
      ],
    },
    {
      title: "Availability",
      rows: [{ label: "Providers", cell: (m) => <ProviderBadges names={providers[m.id]} /> }],
    },
  ];

  const labelCell = "sticky left-0 z-10 w-36 bg-surface px-4 text-left align-top text-sm font-normal text-muted sm:w-48 sm:px-5";
  const modelCell = "min-w-52 snap-start px-4 align-top";

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
      <div className="relative snap-x snap-mandatory overflow-x-auto scroll-pl-36 sm:scroll-pl-48">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Side-by-side comparison of the selected models</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className={`${labelCell} py-4 align-bottom font-medium text-fg`}>
                Specification
              </th>
              {models.map((m) => (
                <th key={m.id} scope="col" className={`${modelCell} py-4 text-left font-normal`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <BrandLogo labName={m.labName} />
                      <div className="min-w-0">
                        <Link href={modelHref(m.id)} className="block truncate rounded font-semibold hover:underline">
                          {m.name}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge tone="outline">{m.labName}</Badge>
                          <span className="text-xs text-muted">{formatDate(m.releasedAt)}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(m.id)}
                      aria-label={`Remove ${m.name} from comparison`}
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          {sections.map((section) => (
            <tbody key={section.title}>
              <tr>
                <th
                  scope="colgroup"
                  colSpan={models.length + 1}
                  className="bg-surface-2/50 px-4 pt-5 pb-2 text-left text-xs font-semibold tracking-wider text-muted uppercase sm:px-5"
                >
                  {/* Sticky inner span keeps the section title visible while scrolling sideways. */}
                  <span className="sticky left-4 sm:left-5">{section.title}</span>
                </th>
              </tr>
              {section.rows.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <th scope="row" className={`${labelCell} py-3`}>
                    {row.label}
                  </th>
                  {models.map((m) => (
                    <td key={m.id} className={`${modelCell} py-3`}>
                      {row.cell(m)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      {models.some((m) => Object.values(m.benchmarks).some((s) => s?.source === "sample")) ? (
        <p className="border-t border-border px-5 py-3 text-xs text-muted">
          † Sample benchmark value from the assessment brief. Other scores: Artificial Analysis, via OpenRouter.
        </p>
      ) : null}
    </div>
  );
}

function PriceCell({ value, lowest }: { value: number | null; lowest: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono tabular-nums">{formatPrice(value)}</span>
      {lowest ? <Badge tone="accent">Lowest</Badge> : null}
    </span>
  );
}

function Modalities({ values }: { values: string[] }) {
  if (values.length === 0) return <span className="text-muted">-</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {values.map((v) => (
        <Badge key={v} tone="neutral" className="capitalize">
          {v}
        </Badge>
      ))}
    </span>
  );
}

function ProviderBadges({ names }: { names: string[] | null | undefined }) {
  if (names === undefined) {
    return (
      <span role="status" className="block h-5 w-28 animate-pulse rounded bg-surface-2">
        <span className="sr-only">Loading providers</span>
      </span>
    );
  }
  if (names === null) return <span className="text-muted">Unavailable</span>;
  if (names.length === 0) return <span className="text-muted">-</span>;
  const extra = names.length - MAX_PROVIDER_BADGES;
  return (
    <span className="flex flex-wrap gap-1">
      {names.slice(0, MAX_PROVIDER_BADGES).map((name) => (
        <Badge key={name} tone="outline">
          {name}
        </Badge>
      ))}
      {extra > 0 ? <Badge tone="neutral" title={names.slice(MAX_PROVIDER_BADGES).join(", ")}>+{extra} more</Badge> : null}
    </span>
  );
}
