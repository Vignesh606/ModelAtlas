import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { LocalTime } from "@/components/history/local-time";
import { StatusBadge } from "@/components/history/status-badge";
import { Markdown } from "@/components/playground/markdown";
import { buttonClasses } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { formatUsd } from "@/lib/cost";
import { getCatalog } from "@/lib/data";
import { formatInteger } from "@/lib/format";
import { getHistoryItem, isHistoryEnabled } from "@/lib/history";
import { isUuid } from "@/lib/history-query";
import { modelHref, playgroundHref } from "@/lib/routes";
import { readSessionId } from "@/lib/session";

export const metadata: Metadata = { title: "Request details" };

/*
 * Params and the session cookie are request-time data, so the content
 * streams behind <Suspense>. Rows from other sessions are a 404, the same as
 * ids that don't exist.
 */
export default function HistoryItemPage({ params }: PageProps<"/history/[id]">) {
  return (
    <Suspense fallback={<div role="status" aria-label="Loading request" className="h-96 animate-pulse rounded-2xl bg-surface-2" />}>
      <HistoryItem params={params} />
    </Suspense>
  );
}

async function HistoryItem({ params }: { params: PageProps<"/history/[id]">["params"] }) {
  const [{ id }, sessionId, catalog] = await Promise.all([params, readSessionId(), getCatalog()]);
  if (!isHistoryEnabled() || !sessionId || !isUuid(id)) notFound();

  const row = await getHistoryItem(sessionId, id);
  if (!row) notFound();

  const model = catalog.models.find((m) => m.id === row.model);
  const canRetry = model?.source === "live";

  const metrics = [
    { label: "Prompt tokens", value: row.promptTokens === null ? "-" : formatInteger(row.promptTokens) },
    { label: "Completion tokens", value: row.completionTokens === null ? "-" : formatInteger(row.completionTokens) },
    { label: "Total tokens", value: row.totalTokens === null ? "-" : formatInteger(row.totalTokens) },
    { label: "Latency", value: `${(row.latencyMs / 1000).toFixed(2)}s` },
    { label: "Cost", value: row.costUsd === null ? "-" : formatUsd(row.costUsd) },
  ];

  return (
    <article className="space-y-6">
      <Link href="/history" className="inline-flex items-center gap-1.5 rounded text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden />
        All requests
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl tracking-tight">{model?.name ?? row.model}</h1>
            <StatusBadge status={row.status} />
          </div>
          <p className="text-sm text-muted">
            <LocalTime iso={row.createdAt.toISOString()} /> · <span className="font-mono">{row.model}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canRetry ? (
            <Link href={playgroundHref(row.model)} className={buttonClasses("primary", "sm")}>
              Open in playground
            </Link>
          ) : null}
          {model ? (
            <Link href={modelHref(model.id)} className={buttonClasses("secondary", "sm")}>
              Model details
            </Link>
          ) : null}
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-5">
        {metrics.map((m) => (
          <div key={m.label} className="bg-surface p-4">
            <dd className="font-mono text-lg tabular-nums">{m.value}</dd>
            <dt className="mt-0.5 text-xs text-muted">{m.label}</dt>
          </div>
        ))}
      </dl>

      {row.errorMessage ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-border-strong bg-surface px-4 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {row.errorMessage}
        </p>
      ) : null}

      <Block title="Prompt" copyText={row.prompt}>
        <p className="text-sm whitespace-pre-wrap">{row.prompt}</p>
      </Block>
      <Block title="Response" copyText={row.response}>
        {row.response ? <Markdown text={row.response} /> : <p className="text-sm text-muted">No response text.</p>}
      </Block>
    </article>
  );
}

function Block({ title, copyText, children }: { title: string; copyText: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">{title}</h2>
        {copyText ? <CopyButton text={copyText} label={`Copy ${title.toLowerCase()}`} /> : null}
      </div>
      {children}
    </section>
  );
}
