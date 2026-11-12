import Link from "next/link";
import { LocalTime } from "@/components/history/local-time";
import { StatusBadge } from "@/components/history/status-badge";
import { formatInteger } from "@/lib/format";
import type { HistoryListItem } from "@/lib/history";

/** Server-rendered list; each row links to its detail page. */
export function HistoryTable({ items, modelName }: { items: HistoryListItem[]; modelName: (id: string) => string }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th scope="col" className="py-2.5 pr-3 pl-4 font-medium sm:pl-5">Time</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Model</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Prompt</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Tokens</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Latency</th>
            <th scope="col" className="py-2.5 pr-4 pl-3 font-medium sm:pr-5">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="relative border-b border-border transition-colors duration-150 last:border-0 hover:bg-surface-2">
              <td className="py-3 pr-3 pl-4 text-xs whitespace-nowrap text-muted sm:pl-5">
                <LocalTime iso={item.createdAt} />
              </td>
              <td className="max-w-48 truncate px-3">{modelName(item.model)}</td>
              <td className="max-w-80 px-3">
                {/* Stretched link: the whole row is clickable, the prompt is the accessible name. */}
                <Link
                  href={`/history/${item.id}`}
                  className="line-clamp-1 rounded after:absolute after:inset-0 hover:underline"
                >
                  {item.promptPreview || "(empty prompt)"}
                </Link>
              </td>
              <td className="px-3 text-right font-mono tabular-nums">
                {item.totalTokens === null ? "-" : formatInteger(item.totalTokens)}
              </td>
              <td className="px-3 text-right font-mono whitespace-nowrap tabular-nums">{(item.latencyMs / 1000).toFixed(1)}s</td>
              <td className="py-3 pr-4 pl-3 sm:pr-5">
                <StatusBadge status={item.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
