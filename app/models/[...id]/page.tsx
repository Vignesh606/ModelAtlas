import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Minus } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ModelBadges, ScoreValue } from "@/components/catalog/model-badges";
import { CompareToggle } from "@/components/compare-toggle";
import { ScrollProgress } from "@/components/site/scroll-progress";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { getModel, getProviders } from "@/lib/data";
import { formatContext, formatDate, formatInteger, formatPrice } from "@/lib/format";
import { idFromSegments, playgroundHref } from "@/lib/routes";
import { SAMPLE_MODEL_IDS } from "@/lib/sample-data";
import type { ProviderListing } from "@/lib/types";

/*
 * Catch-all route because model ids contain a slash: /models/openai/gpt-6.1-terra.
 * Cache Components requires at least one sample param; we prerender the three
 * brief models. Any other id renders on first request and is then cached.
 */
export function generateStaticParams() {
  return SAMPLE_MODEL_IDS.map((id) => ({ id: id.split("/") }));
}

async function loadModel(params: PageProps<"/models/[...id]">["params"]) {
  const id = idFromSegments((await params).id);
  return id ? getModel(id) : undefined;
}

export async function generateMetadata({ params }: PageProps<"/models/[...id]">): Promise<Metadata> {
  const model = await loadModel(params);
  return { title: model ? `${model.name} (${model.labName})` : "Model not found" };
}

export default async function ModelPage({ params }: PageProps<"/models/[...id]">) {
  const model = await loadModel(params);
  if (!model) notFound();

  const providers = await getProviders(model);
  const compareItem = { id: model.id, name: model.name, labName: model.labName };
  const capabilities = [
    { label: "Reasoning", on: model.capabilities.reasoning },
    { label: "Tool calling", on: model.capabilities.tools },
    { label: "Vision input", on: model.capabilities.vision },
    { label: "Open weights", on: model.capabilities.openWeights },
  ];

  return (
    <article className="space-y-8">
      <ScrollProgress />
      <Link href="/" className="inline-flex items-center gap-1.5 rounded text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden />
        All models
      </Link>

      <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <BrandLogo labName={model.labName} size="lg" />
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{model.name}</h1>
              <ModelBadges model={model} />
            </div>
            <p className="text-sm text-muted">
              {model.labName} · Released {formatDate(model.releasedAt)}
              {model.expiresAt ? ` · Retires ${formatDate(model.expiresAt)}` : ""}
            </p>
            <code className="inline-block max-w-full truncate rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-xs text-muted">
              {model.id}
            </code>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {model.source === "live" ? (
            <Link href={playgroundHref(model.id)} className={buttonClasses("primary")}>
              Try in Playground
            </Link>
          ) : null}
          <CompareToggle item={compareItem} variant="button" />
        </div>
      </header>

      {model.source === "sample" ? (
        <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
          This model comes from the assessment&apos;s sample data and is not listed on OpenRouter, so it can be
          compared but not tried in the playground.
        </p>
      ) : null}

      {model.description ? <p className="max-w-3xl leading-relaxed text-muted">{model.description}</p> : null}

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
        {[
          { label: "Context window", value: formatContext(model.context) },
          { label: "Input / 1M", value: formatPrice(model.pricing.input) },
          { label: "Output / 1M", value: formatPrice(model.pricing.output) },
          { label: "Providers", value: providers.length ? String(providers.length) : "-" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-surface p-5">
            <dd className="font-mono text-2xl tabular-nums">{value}</dd>
            <dt className="mt-1 text-xs text-muted">{label}</dt>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Pricing" note="USD per 1M tokens">
          <SpecRow label="Input" value={formatPrice(model.pricing.input)} mono />
          <SpecRow label="Output" value={formatPrice(model.pricing.output)} mono />
          <SpecRow label="Cache read" value={formatPrice(model.pricing.cacheRead)} mono />
          <SpecRow label="Cache write" value={formatPrice(model.pricing.cacheWrite)} mono />
        </Panel>

        <Panel title="Technical limits">
          <SpecRow label="Context window" value={model.context ? `${formatInteger(model.context)} tokens` : "-"} mono />
          <SpecRow label="Max output" value={model.maxOutput ? `${formatInteger(model.maxOutput)} tokens` : "-"} mono />
          <SpecRow label="Input modalities" value={model.input.join(", ") || "-"} />
          <SpecRow label="Output modalities" value={model.output.join(", ") || "-"} />
        </Panel>

        <Panel title="Capabilities">
          <ul className="grid grid-cols-2 gap-3 text-sm">
            {capabilities.map(({ label, on }) => (
              <li key={label} className={on ? "flex items-center gap-2" : "flex items-center gap-2 text-muted"}>
                {on ? <Check className="size-4" aria-hidden /> : <Minus className="size-4" aria-hidden />}
                {label}
                <span className="sr-only">{on ? "supported" : "not supported"}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Benchmarks" note="Artificial Analysis indexes, via OpenRouter">
          <SpecRow label="Intelligence" value={<ScoreValue score={model.benchmarks.intelligence} />} mono />
          <SpecRow label="Coding" value={<ScoreValue score={model.benchmarks.coding} />} mono />
          <SpecRow label="Agentic" value={<ScoreValue score={model.benchmarks.agentic} />} mono />
          {Object.values(model.benchmarks).some((s) => s?.source === "sample") ? (
            <p className="pt-2 text-xs text-muted">† Sample value from the assessment brief.</p>
          ) : null}
        </Panel>
      </div>

      <ProvidersTable providers={providers} />
    </article>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">{title}</h2>
        {note ? <span className="text-xs text-muted">{note}</span> : null}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function SpecRow({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className={mono ? "font-mono tabular-nums" : "capitalize"}>{value}</span>
    </div>
  );
}

function ProvidersTable({ providers }: { providers: ProviderListing[] }) {
  if (providers.length === 0) {
    return <p className="text-sm text-muted">Provider information is not available for this model.</p>;
  }
  const prices = providers.map((p) => p.inputPrice).filter((p): p is number => p !== null);
  const lowest = prices.length > 1 ? Math.min(...prices) : null; // only badge when there's a real choice

  return (
    <section aria-labelledby="providers-title" className="rounded-2xl border border-border bg-surface shadow-card">
      <h2 id="providers-title" className="px-5 pt-5 text-xs font-semibold tracking-wider text-muted uppercase">
        Providers
      </h2>
      <div className="relative overflow-x-auto">
        <table className="mt-3 w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th scope="col" className="px-5 py-2 text-left font-medium">Provider</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Input / 1M</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Output / 1M</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Context</th>
              <th scope="col" className="px-5 py-2 text-right font-medium">Quantization</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p.name} className="border-b border-border last:border-0">
                <td className="px-5 py-2.5 font-medium">{p.name}</td>
                <td className="px-3 text-right font-mono tabular-nums">
                  <span className="inline-flex items-center gap-2">
                    {lowest !== null && p.inputPrice === lowest ? <Badge tone="accent">Lowest</Badge> : null}
                    {formatPrice(p.inputPrice)}
                  </span>
                </td>
                <td className="px-3 text-right font-mono tabular-nums">{formatPrice(p.outputPrice)}</td>
                <td className="px-3 text-right font-mono tabular-nums">{formatContext(p.context)}</td>
                <td className="px-5 text-right text-muted">{p.quantization ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
