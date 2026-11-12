import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { Catalog } from "@/components/catalog/catalog";
import { CatalogSkeleton } from "@/components/catalog/catalog-skeleton";
import { HeroStats } from "@/components/hero-stats";
import { SectionHeading } from "@/components/section-heading";
import { buttonClasses } from "@/components/ui/button";
import { listLabs, parseCatalogParams } from "@/lib/catalog";
import { getCatalog } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { computeStats } from "@/lib/stats";
import type { Model, ModelSummary } from "@/lib/types";

/*
 * Rendering: the hero only uses cached catalog data, so it is part of the
 * static shell. The catalog reads searchParams (request-time data), so it sits
 * behind <Suspense>: the skeleton is served instantly and the filtered table
 * streams in, already matching the URL.
 */
export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <div className="space-y-14">
      <Hero />
      <section aria-labelledby="catalog-title">
        <SectionHeading id="catalog-title" eyebrow="Filter & select" title="Model catalog" />
        <Suspense fallback={<CatalogSkeleton />}>
          <CatalogLoader searchParams={searchParams} />
        </Suspense>
      </section>
    </div>
  );
}

async function Hero() {
  const catalog = await getCatalog();
  const stats = computeStats(catalog.models, new Date(catalog.fetchedAt));

  return (
    <section aria-labelledby="hero-title" className="grid items-center gap-10 lg:grid-cols-[1fr_minmax(0,540px)]">
      <div className="space-y-5">
        <p className="text-sm text-muted">Last refreshed {formatDate(catalog.fetchedAt)}</p>
        <h1 id="hero-title" className="font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          The whole AI model landscape, on one page.
        </h1>
        <p className="max-w-xl text-muted">
          Compare context windows, token prices, capabilities and where each model is hosted. Sort, filter and
          estimate your monthly API bill side by side.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/compare" className={buttonClasses("primary")}>
            Compare models
          </Link>
          <Link href="/playground" className={buttonClasses("secondary")}>
            AI Playground
          </Link>
          <Link href="#catalog-title" className={buttonClasses("ghost", "md", "text-fg")}>
            Browse catalog <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        {catalog.status === "fallback" ? (
          <p role="status" className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted">
            The live OpenRouter catalog is unavailable right now, so sample data is shown.
          </p>
        ) : null}
      </div>
      <HeroStats stats={stats} />
    </section>
  );
}

/** Strips long text fields before sending the list to the client island. */
function toSummary(model: Model): ModelSummary {
  const { description, supportedParameters, ...summary } = model;
  return summary;
}

async function CatalogLoader({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const [catalog, params] = await Promise.all([getCatalog(), searchParams]);
  const models = catalog.models.map(toSummary);
  return <Catalog models={models} labs={listLabs(models)} initialState={parseCatalogParams(params)} />;
}
