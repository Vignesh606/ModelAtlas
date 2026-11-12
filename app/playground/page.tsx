import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageIntro } from "@/components/page-intro";
import { Playground } from "@/components/playground/playground";
import { getCatalog } from "@/lib/data";
import { getServerEnv, serverKeyFor } from "@/lib/env";
import { DEFAULT_FREE_MODELS, isChatModel, pickDefaultModel, toChatModel, type ChatModel } from "@/lib/playground";
import { fetchProviderModels } from "@/lib/provider-models";
import { PROVIDER_IDS, PROVIDERS, type ProviderId } from "@/lib/providers";

export const metadata: Metadata = {
  title: "Playground",
  description: "Chat with AI models, stream replies, compare two models side by side and see token usage and cost.",
};

export default function PlaygroundPage({ searchParams }: PageProps<"/playground">) {
  return (
    <>
      <PageIntro title="AI Playground">
        Chat with models from OpenRouter, Google and other providers, compare two side by side, and see tokens and projected cost for each reply.
        API keys stay on the server. Prompts and replies are saved to your <Link href="/history" className="underline underline-offset-2 hover:text-fg">history</Link>,
        tied to this browser only.
      </PageIntro>
      <Suspense fallback={<PlaygroundSkeleton />}>
        <PlaygroundLoader searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function PlaygroundLoader({ searchParams }: { searchParams: PageProps<"/playground">["searchParams"] }) {
  // Providers (other than OpenRouter) the server has its own key for, e.g. GEMINI_API_KEY.
  const serverProviders = PROVIDER_IDS.filter((p) => p !== "openrouter" && serverKeyFor(p));
  const [catalog, params, ...loaded] = await Promise.all([
    getCatalog(),
    searchParams,
    ...serverProviders.map((p) => fetchProviderModels(p, serverKeyFor(p)!, false)),
  ]);
  // A provider that fails to list models is skipped; the catalog still works.
  const providerModels = loaded.flatMap((r) => ("models" in r ? r.models : []));
  const models = [...providerModels, ...catalog.models.filter(isChatModel).map(toChatModel)];

  const requested = typeof params.model === "string" ? models.find((m) => m.id === params.model) : undefined;
  // Server-keyed providers come first: their preferred model, else their first model,
  // and only then the OpenRouter defaults.
  const initial =
    requested ??
    pickProviderDefault(providerModels, serverProviders) ??
    pickDefaultModel(models, [getServerEnv().env.OPENROUTER_DEFAULT_MODEL, ...DEFAULT_FREE_MODELS]);
  const second = pickDefaultModel(models.filter((m) => m.id !== initial?.id));

  return (
    <Playground
      // Remount when a link asks for a different model (Next keeps visited pages mounted).
      key={initial?.id ?? "none"}
      models={models}
      initialModelId={initial?.id ?? ""}
      secondModelId={second?.id ?? initial?.id ?? ""}
      serverHasKey={Boolean(serverKeyFor("openrouter"))}
      serverProviders={serverProviders}
    />
  );
}

function pickProviderDefault(models: ChatModel[], providers: ProviderId[]): ChatModel | undefined {
  for (const provider of providers) {
    const own = models.filter((m) => m.provider === provider);
    const preferred = own.find((m) => m.upstreamId === PROVIDERS[provider].defaultModel);
    if (preferred ?? own[0]) return preferred ?? own[0];
  }
  return undefined;
}

function PlaygroundSkeleton() {
  return (
    <div role="status" aria-label="Loading playground" className="grid animate-pulse grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-3">
        <div className="h-[62vh] min-h-96 rounded-2xl bg-surface-2" />
        <div className="h-24 rounded-xl bg-surface-2" />
      </div>
      <div className="h-96 rounded-2xl bg-surface-2" />
    </div>
  );
}
