import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageIntro } from "@/components/page-intro";
import { Playground } from "@/components/playground/playground";
import { getCatalog } from "@/lib/data";
import { getServerEnv, serverKeyFor } from "@/lib/env";
import { DEFAULT_FREE_MODELS, DEFAULT_GEMINI_MODELS, isChatModel, orderModels, pickDefaultModel, toChatModel, type ChatModel } from "@/lib/playground";
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
        Chat with AI models from Google, OpenRouter and other providers, compare two side by side, and see tokens and projected cost for each reply.
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
  // Providers the server has its own key for. Gemini is checked first (primary),
  // then all others (including OpenRouter) that have API keys configured.
  const serverProviders = PROVIDER_IDS.filter((p) => serverKeyFor(p));

  // Separate out which optional providers (non-Gemini) have server keys,
  // and always try to load Gemini models if it has a key.
  const providersToLoad = serverProviders.filter((p) => p !== "openrouter");

  const [catalog, params, ...loaded] = await Promise.all([
    getCatalog(),
    searchParams,
    ...providersToLoad.map((p) => fetchProviderModels(p, serverKeyFor(p)!, false)),
  ]);

  // A provider that fails to list models is skipped; the catalog still works.
  const providerModels = loaded.flatMap((r) => ("models" in r ? r.models : []));
  const catalogModels = catalog.models.filter(isChatModel).map(toChatModel);

  // Order models: models from configured providers first (Gemini at top if
  // configured), then OpenRouter catalog models. If no optional API keys are
  // configured at all, Gemini defaults appear at the top of the list.
  const models = orderModels(providerModels, catalogModels, serverProviders);

  const requested = typeof params.model === "string" ? models.find((m) => m.id === params.model) : undefined;

  // Build the preferred model chain:
  // 1. Env overrides (GEMINI_DEFAULT_MODEL, OPENROUTER_DEFAULT_MODEL)
  // 2. Server-keyed provider defaults (Gemini first, then others)
  // 3. Built-in Gemini defaults
  // 4. OpenRouter free model defaults
  const initial =
    requested ??
    pickProviderDefault(providerModels, serverProviders) ??
    pickDefaultModel(models, [
      getServerEnv().env.GEMINI_DEFAULT_MODEL ? `gemini:${getServerEnv().env.GEMINI_DEFAULT_MODEL}` : undefined,
      getServerEnv().env.OPENROUTER_DEFAULT_MODEL,
      ...DEFAULT_GEMINI_MODELS,
      ...DEFAULT_FREE_MODELS,
    ]);
  const second = pickDefaultModel(models.filter((m) => m.id !== initial?.id));

  return (
    <Playground
      // Remount when a link asks for a different model (Next keeps visited pages mounted).
      key={initial?.id ?? "none"}
      models={models}
      initialModelId={initial?.id ?? ""}
      secondModelId={second?.id ?? initial?.id ?? ""}
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
