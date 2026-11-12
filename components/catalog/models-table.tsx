"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ModelBadges, ScoreValue } from "@/components/catalog/model-badges";
import { CompareToggle } from "@/components/compare-toggle";
import type { SortDir, SortKey } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { formatContext, formatDate, formatPrice } from "@/lib/format";
import { modelHref } from "@/lib/routes";
import type { ModelSummary } from "@/lib/types";

const COLUMNS: Array<{ key: SortKey; label: string; numeric: boolean }> = [
  { key: "name", label: "Model", numeric: false },
  { key: "context", label: "Context", numeric: true },
  { key: "input", label: "Input / 1M", numeric: true },
  { key: "output", label: "Output / 1M", numeric: true },
  { key: "intelligence", label: "Intelligence", numeric: true },
  { key: "released", label: "Released", numeric: true },
];

export function ModelsTable({
  rows,
  sort,
  dir,
  onSort,
}: {
  rows: ModelSummary[];
  sort: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const router = useRouter();

  // The whole row is clickable for mouse users. Keyboard and screen-reader
  // users get a real link on the model name, so we don't need role="link" on <tr>.
  const onRowClick = (event: MouseEvent<HTMLTableRowElement>, id: string) => {
    if ((event.target as HTMLElement).closest("a, button")) return;
    router.push(modelHref(id));
  };

  return (
    // Horizontal scroll on narrow screens; the model column stays pinned.
    <div className="-mx-4 overflow-x-auto sm:-mx-5">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted">
            {COLUMNS.map(({ key, label, numeric }) => {
              const active = sort === key;
              const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
              return (
                <th
                  key={key}
                  scope="col"
                  aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
                  className={cn(
                    "px-3 py-2.5 font-medium first:sticky first:left-0 first:z-10 first:bg-surface first:pl-4 sm:first:pl-5",
                    numeric ? "text-right" : "text-left",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSort(key)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded transition-colors duration-150 hover:text-fg",
                      active && "text-fg",
                    )}
                  >
                    {label}
                    <Icon className={cn("size-3", !active && "opacity-50")} aria-hidden />
                  </button>
                </th>
              );
            })}
            <th scope="col" className="w-12 py-2.5 pr-4 sm:pr-5">
              <span className="sr-only">Compare</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr
              key={m.id}
              onClick={(e) => onRowClick(e, m.id)}
              className="group cursor-pointer border-b border-border transition-colors duration-150 last:border-0 hover:bg-surface-2"
            >
              <td className="sticky left-0 z-10 max-w-80 bg-surface py-3 pr-3 pl-4 transition-colors duration-150 group-hover:bg-surface-2 sm:pl-5">
                <div className="flex items-center gap-3">
                  <BrandLogo labName={m.labName} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Link href={modelHref(m.id)} className="truncate rounded font-medium hover:underline">
                        {m.name}
                      </Link>
                      <ModelBadges model={m} />
                    </div>
                    <p className="truncate text-xs text-muted">{m.labName}</p>
                  </div>
                </div>
              </td>
              <td className="px-3 text-right font-mono tabular-nums">{formatContext(m.context)}</td>
              <td className="px-3 text-right font-mono tabular-nums">{formatPrice(m.pricing.input)}</td>
              <td className="px-3 text-right font-mono tabular-nums">{formatPrice(m.pricing.output)}</td>
              <td className="px-3 text-right font-mono tabular-nums">
                <ScoreValue score={m.benchmarks.intelligence} />
              </td>
              <td className="px-3 text-right text-xs whitespace-nowrap text-muted">{formatDate(m.releasedAt)}</td>
              <td className="py-2 pr-4 text-right sm:pr-5">
                <CompareToggle item={{ id: m.id, name: m.name, labName: m.labName }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
