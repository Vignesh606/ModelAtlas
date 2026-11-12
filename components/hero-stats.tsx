import type { CatalogStats } from "@/lib/stats";
import { formatInteger } from "@/lib/format";

/*
 * Server Component: no JS shipped. The bar tooltips are CSS-only (group-hover),
 * and each bar carries screen-reader text, so the list doubles as the
 * accessible "table view" of the chart.
 */
export function HeroStats({ stats }: { stats: CatalogStats }) {
  const figures = [
    { label: "Models", value: stats.models },
    { label: "Labs", value: stats.labs },
    { label: "Free models", value: stats.free },
    { label: "With benchmarks", value: stats.withBenchmarks },
  ];
  const max = Math.max(1, ...stats.releasesByMonth.map((m) => m.count));
  const first = stats.releasesByMonth[0];
  const last = stats.releasesByMonth.at(-1);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
      <dl className="grid grid-cols-2 gap-4 px-1 pb-5 sm:grid-cols-4">
        {figures.map(({ label, value }) => (
          <div key={label}>
            <dd className="font-mono text-2xl tabular-nums">{formatInteger(value)}</dd>
            <dt className="mt-0.5 text-xs text-muted">{label}</dt>
          </div>
        ))}
      </dl>

      <div className="grid gap-3 sm:grid-cols-2">
        <figure className="rounded-xl border border-border bg-bg p-4">
          <figcaption className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium">Releases per month</span>
            <span className="text-xs text-muted">
              <span className="font-mono text-fg tabular-nums">{stats.releasesTotal}</span> in 12 mo
            </span>
          </figcaption>
          {/* gap-0.5 = the 2px surface gap between adjacent bars */}
          <ol className="mt-4 flex h-24 items-end gap-0.5">
            {stats.releasesByMonth.map((m) => (
              <li key={m.key} className="group relative flex h-full flex-1 items-end justify-center">
                <span
                  aria-hidden
                  className="w-full max-w-6 rounded-t bg-chart transition-opacity duration-150 group-hover:opacity-80"
                  style={{ height: `${(m.count / max) * 100}%` }}
                />
                <span className="sr-only">
                  {m.label}: {m.count} releases
                </span>
                <span
                  aria-hidden
                  className="pointer-events-none absolute bottom-full z-10 mb-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] whitespace-nowrap opacity-0 shadow-card transition-opacity duration-150 group-hover:opacity-100"
                >
                  {m.label} · <span className="font-mono tabular-nums">{m.count}</span>
                </span>
              </li>
            ))}
          </ol>
          <div aria-hidden className="mt-2 flex justify-between text-[11px] text-muted">
            <span>{first?.label}</span>
            <span>{last?.label}</span>
          </div>
        </figure>

        <div className="rounded-xl border border-border bg-bg p-4">
          <p className="text-sm font-medium">Capability coverage</p>
          <ul className="mt-3 space-y-3">
            {stats.coverage.map(({ label, share }) => {
              const pct = Math.round(share * 100);
              return (
                <li key={label}>
                  <div className="flex justify-between text-xs">
                    <span>{label}</span>
                    <span className="font-mono tabular-nums">{pct}%</span>
                  </div>
                  {/* Decorative: the percentage text above carries the value. */}
                  <div aria-hidden className="mt-1.5 h-1.5 rounded-full bg-border">
                    <div className="h-full rounded-full bg-fg" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
