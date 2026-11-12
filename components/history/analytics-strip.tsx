import { formatInteger } from "@/lib/format";
import type { HistoryStats } from "@/lib/history";

const MAX_BARS = 6;

/*
 * Four stat tiles + one chart (requests per model). Single series, so one
 * neutral color and no legend; every bar has its count as text, so the bars
 * themselves are decorative (aria-hidden) and the list reads as plain data.
 */
export function AnalyticsStrip({ stats, modelName }: { stats: HistoryStats; modelName: (id: string) => string }) {
  const top = stats.byModel.slice(0, MAX_BARS);
  const otherCount = stats.byModel.slice(MAX_BARS).reduce((sum, m) => sum + m.count, 0);
  const bars = otherCount ? [...top.map((m) => ({ label: modelName(m.model), count: m.count })), { label: "Other models", count: otherCount }] : top.map((m) => ({ label: modelName(m.model), count: m.count }));
  const max = Math.max(1, ...bars.map((b) => b.count));

  const tiles = [
    { label: "Requests", value: formatInteger(stats.total) },
    { label: "Total tokens", value: formatInteger(stats.totalTokens) },
    { label: "Avg latency", value: stats.avgLatencyMs === null ? "-" : `${(stats.avgLatencyMs / 1000).toFixed(1)}s`, note: "successful requests" },
    { label: "Success rate", value: stats.successRate === null ? "-" : `${Math.round(stats.successRate * 100)}%` },
  ];

  return (
    <section aria-label="Usage analytics" className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <dl className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-border bg-surface p-4 shadow-card">
            <dt className="text-sm text-muted">{t.label}</dt>
            <dd className="mt-1.5 font-mono text-2xl tabular-nums">{t.value}</dd>
            {t.note ? <dd className="mt-0.5 text-xs text-muted">{t.note}</dd> : null}
          </div>
        ))}
      </dl>

      <figure className="rounded-2xl border border-border bg-surface p-4 shadow-card">
        <figcaption className="text-sm font-medium">Requests per model</figcaption>
        {bars.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No data yet.</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {bars.map((b) => (
              <li key={b.label}>
                <div className="flex justify-between gap-3 text-xs">
                  <span className="truncate">{b.label}</span>
                  <span className="font-mono tabular-nums">{formatInteger(b.count)}</span>
                </div>
                {/* Bar: square at the baseline, rounded at the data end. */}
                <div aria-hidden className="mt-1 h-2 rounded-r bg-chart" style={{ width: `${(b.count / max) * 100}%` }} />
              </li>
            ))}
          </ul>
        )}
      </figure>
    </section>
  );
}
