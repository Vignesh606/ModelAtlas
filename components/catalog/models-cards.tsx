import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ModelBadges, ScoreValue } from "@/components/catalog/model-badges";
import { CompareToggle } from "@/components/compare-toggle";
import { isFree } from "@/lib/catalog";
import { formatContext, formatPrice } from "@/lib/format";
import { modelHref } from "@/lib/routes";
import type { ModelSummary } from "@/lib/types";

/**
 * Card grid. Uses the "stretched link" pattern: the title link's ::after covers
 * the card, so the whole card is clickable while the compare button (z-10)
 * stays a separate control. Nesting a button inside a link would be invalid HTML.
 */
/** Mirrors ModelBadges: only render the badge row when it has something in it. */
const hasBadges = (m: ModelSummary) => isFree(m) || m.expiresAt !== null || m.source === "sample";

export function ModelsCards({ rows }: { rows: ModelSummary[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((m) => (
        <li
          key={m.id}
          className="relative flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-bg p-4 transition-colors duration-150 hover:border-border-strong"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <BrandLogo labName={m.labName} />
              <div className="min-w-0">
                <Link
                  href={modelHref(m.id)}
                  className="block truncate rounded font-medium after:absolute after:inset-0 after:rounded-xl hover:underline"
                >
                  {m.name}
                </Link>
                <p className="truncate text-xs text-muted">{m.labName}</p>
              </div>
            </div>
            <CompareToggle item={{ id: m.id, name: m.name, labName: m.labName }} />
          </div>
          {hasBadges(m) ? (
            <div className="flex flex-wrap gap-1.5">
              <ModelBadges model={m} />
            </div>
          ) : null}
          <dl className="mt-auto grid grid-cols-4 gap-2 text-xs">
            {[
              { label: "Context", value: formatContext(m.context) },
              { label: "Input", value: formatPrice(m.pricing.input) },
              { label: "Output", value: formatPrice(m.pricing.output) },
            ].map(({ label, value }) => (
              <div key={label}>
                <dt className="text-muted">{label}</dt>
                <dd className="mt-0.5 font-mono text-sm tabular-nums">{value}</dd>
              </div>
            ))}
            <div>
              <dt className="text-muted">Intel.</dt>
              <dd className="mt-0.5 font-mono text-sm tabular-nums">
                <ScoreValue score={m.benchmarks.intelligence} />
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}
