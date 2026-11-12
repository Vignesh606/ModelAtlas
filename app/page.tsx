import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { Catalog } from "@/components/catalog/catalog";
import { CatalogSkeleton } from "@/components/catalog/catalog-skeleton";
import { HeroStats } from "@/components/hero-stats";
import { RankingsSection } from "@/components/rankings/rankings-section";
import { SectionHeading } from "@/components/section-heading";
import { Faq } from "@/components/site/faq";
import { ScrollProgress } from "@/components/site/scroll-progress";
import { buttonClasses } from "@/components/ui/button";
import { listLabs, parseCatalogParams, serializeCatalogParams } from "@/lib/catalog";
import { getCatalog } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { computeStats } from "@/lib/stats";
import { toSummary } from "@/lib/summary";

/*
 * Rendering: the hero only uses cached catalog data, so it is part of the
 * static shell. The catalog reads searchParams (request-time data), so it sits
 * behind <Suspense>: the skeleton is served instantly and the filtered table
 * streams in, already matching the URL.
 */
export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <div className="space-y-14">
      <ScrollProgress />
      <Hero />
      <section id="rankings" aria-labelledby="rankings-title" className="scroll-mt-20">
        <SectionHeading
          id="rankings-title"
          eyebrow="Leaderboard"
          title="Model rankings & benchmarks"
          description="Top 10 models by benchmark score. Expand to view all ranked models, or scroll down for the category breakdown."
        />
        <RankingsLoader />
      </section>
      <section aria-labelledby="catalog-title">
        <SectionHeading id="catalog-title" eyebrow="Filter & select" title="Model catalog" />
        <Suspense fallback={<CatalogSkeleton />}>
          <CatalogLoader searchParams={searchParams} />
        </Suspense>
      </section>
      <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20">
        <SectionHeading
          id="faq-title"
          eyebrow="FAQ"
          title="Questions, answered"
          description="Where the data comes from, how accurate it is, and what we store."
        />
        <Faq />
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
        <h1 id="hero-title" className="font-display text-5xl leading-[1.05] tracking-tight text-balance sm:text-6xl">
          The whole AI model landscape, on one page.
        </h1>
        <p className="max-w-xl text-pretty text-muted">
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

async function RankingsLoader() {
  const catalog = await getCatalog();
  const models = catalog.models.map(toSummary);
  return <RankingsSection models={models} />;
}

async function CatalogLoader({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const [catalog, params] = await Promise.all([getCatalog(), searchParams]);
  const models = catalog.models.map(toSummary);
  const initialState = parseCatalogParams(params);
  // Next keeps visited pages mounted (<Activity>), so client state would
  // survive a navigation to a different URL. Keying on the URL state remounts
  // the island whenever the server renders different filters.
  return (
    <Catalog
      key={serializeCatalogParams(initialState)}
      models={models}
      labs={listLabs(models)}
      initialState={initialState}
    />
  );
}
