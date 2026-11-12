import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareSkeleton } from "@/components/compare/compare-skeleton";
import { CompareView } from "@/components/compare/compare-view";
import { PageIntro } from "@/components/page-intro";
import { countRawIds, parseCompareIds } from "@/lib/compare-url";
import { getCatalog, getProviders } from "@/lib/data";
import { SAMPLE_MODEL_IDS } from "@/lib/sample-data";
import { toSummary } from "@/lib/summary";

export const metadata: Metadata = {
  title: "Compare",
  description: "Compare up to 4 AI models side by side: context, modalities, pricing, benchmarks and monthly cost.",
};

/*
 * The heading is static; everything that depends on ?models= is request-time
 * data, so it streams in behind <Suspense>. Because the selection is resolved
 * here on the server, a pasted link (even in a fresh incognito window) renders
 * the full comparison on first load.
 */
export default function ComparePage({ searchParams }: PageProps<"/compare">) {
  return (
    <>
      <PageIntro title="Compare models">
        Pick 2 to 4 models to compare specs, pricing and benchmarks, and estimate your monthly bill.
      </PageIntro>
      <Suspense fallback={<CompareSkeleton />}>
        <CompareLoader searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CompareLoader({ searchParams }: { searchParams: PageProps<"/compare">["searchParams"] }) {
  const [catalog, params] = await Promise.all([getCatalog(), searchParams]);
  const byId = new Map(catalog.models.map((m) => [m.id, m]));

  // Malformed, unknown, duplicate and extra ids are dropped here, never thrown.
  const ids = parseCompareIds(params.models, new Set(byId.keys()));
  const selected = ids.flatMap((id) => byId.get(id) ?? []);
  const providerLists = await Promise.all(selected.map((m) => getProviders(m)));
  const initialProviders = Object.fromEntries(selected.map((m, i) => [m.id, providerLists[i]?.map((p) => p.name) ?? []]));

  return (
    <CompareView
      // Remount when the server renders a different selection (see Catalog for why).
      key={ids.join(",")}
      models={catalog.models.map(toSummary)}
      initialIds={ids}
      initialProviders={initialProviders}
      skipped={Math.max(0, countRawIds(params.models) - ids.length)}
      suggestionIds={[...SAMPLE_MODEL_IDS]}
    />
  );
}
