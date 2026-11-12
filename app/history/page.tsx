import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { AnalyticsStrip } from "@/components/history/analytics-strip";
import { HistoryFilters } from "@/components/history/history-filters";
import { HistoryTable } from "@/components/history/history-table";
import { PageIntro } from "@/components/page-intro";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { getCatalog } from "@/lib/data";
import { getHistoryStats, isHistoryEnabled, listHistory } from "@/lib/history";
import { parseHistoryQuery, serializeHistoryQuery, type HistoryQuery } from "@/lib/history-query";
import { readSessionId } from "@/lib/session";

export const metadata: Metadata = {
  title: "History",
  description: "Your playground requests: prompts, responses, tokens, latency and status.",
};

export default function HistoryPage({ searchParams }: PageProps<"/history">) {
  return (
    <>
      <PageIntro title="Usage history">
        Every playground request from this browser, with tokens, latency and status. History is tied to an anonymous
        session cookie; nobody else can see it.
      </PageIntro>
      <Suspense fallback={<HistorySkeleton />}>
        <HistoryContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function HistoryContent({ searchParams }: { searchParams: PageProps<"/history">["searchParams"] }) {
  if (!isHistoryEnabled()) {
    return <Notice title="History isn't configured">This deployment has no database, so requests aren&apos;t saved.</Notice>;
  }

  const [params, sessionId, catalog] = await Promise.all([searchParams, readSessionId(), getCatalog()]);
  const query = parseHistoryQuery(params);
  const names = new Map(catalog.models.map((m) => [m.id, m.name]));
  const modelName = (id: string) => names.get(id) ?? id;

  if (!sessionId) return <EmptyHistory />;

  let data: Awaited<ReturnType<typeof listHistory>>;
  let stats: Awaited<ReturnType<typeof getHistoryStats>>;
  try {
    [data, stats] = await Promise.all([listHistory(sessionId, query), getHistoryStats(sessionId)]);
  } catch (error) {
    console.error("[history] page load failed:", error instanceof Error ? error.message : error);
    return <Notice title="Couldn't load history">The database didn&apos;t respond. Refresh to try again.</Notice>;
  }

  if (stats.total === 0) return <EmptyHistory />;

  const filtered = Boolean(query.model || query.q);
  const exportQs = serializeHistoryQuery({ model: query.model, q: query.q });

  return (
    <div className="space-y-8">
      <AnalyticsStrip stats={stats} modelName={modelName} />

      <section aria-labelledby="requests-title" className="rounded-2xl border border-border bg-surface shadow-card">
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="requests-title" className="font-display text-2xl">
              Requests
            </h2>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted tabular-nums">{data.total} total</span>
              {(["csv", "json"] as const).map((format) => (
                <a
                  key={format}
                  href={`/api/history/export?format=${format}${exportQs ? `&${exportQs}` : ""}`}
                  download
                  className={buttonClasses("secondary", "sm")}
                >
                  <Download className="size-3.5" aria-hidden />
                  {format.toUpperCase()}
                </a>
              ))}
            </div>
          </div>
          <HistoryFilters
            // Remount when the URL changes from outside (Next keeps pages mounted).
            key={serializeHistoryQuery(query)}
            query={query}
            models={stats.byModel.map((m) => ({ id: m.model, name: modelName(m.model) }))}
          />
        </div>

        {data.items.length === 0 ? (
          <div className="border-t border-border px-6 py-14 text-center">
            <p className="font-medium">No requests match these filters.</p>
            {filtered ? (
              <Link href="/history" className={buttonClasses("secondary", "sm", "mt-4")}>
                Clear filters
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="border-t border-border">
            <HistoryTable items={data.items} modelName={modelName} />
          </div>
        )}

        <Pager query={query} page={data.page} pageCount={data.pageCount} />
      </section>
    </div>
  );
}

function Pager({ query, page, pageCount }: { query: HistoryQuery; page: number; pageCount: number }) {
  if (pageCount <= 1) return null;
  const href = (p: number) => {
    const qs = serializeHistoryQuery({ ...query, page: p });
    return qs ? `/history?${qs}` : "/history";
  };
  const linkClass = (disabled: boolean) => cn(buttonClasses("secondary", "sm"), disabled && "pointer-events-none opacity-40");
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-border p-4">
      <Link href={href(page - 1)} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined} className={linkClass(page <= 1)}>
        <ChevronLeft className="size-4" aria-hidden />
        Previous
      </Link>
      <p className="font-mono text-xs text-muted tabular-nums">
        Page {page} of {pageCount}
      </p>
      <Link href={href(page + 1)} aria-disabled={page >= pageCount} tabIndex={page >= pageCount ? -1 : undefined} className={linkClass(page >= pageCount)}>
        Next
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </nav>
  );
}

function EmptyHistory() {
  return (
    <div className="rounded-2xl border border-dashed border-border-strong px-6 py-16 text-center">
      <p className="font-medium">No requests yet.</p>
      <p className="mt-1 text-sm text-muted">Send a prompt in the playground and it will appear here.</p>
      <Link href="/playground" className={buttonClasses("primary", "md", "mt-5")}>
        Open playground
      </Link>
    </div>
  );
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="status" className="rounded-2xl border border-border bg-surface px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted">{children}</p>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div role="status" aria-label="Loading history" className="animate-pulse space-y-8">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-surface-2" />
          ))}
        </div>
        <div className="h-52 rounded-2xl bg-surface-2" />
      </div>
      <div className="h-96 rounded-2xl bg-surface-2" />
    </div>
  );
}
