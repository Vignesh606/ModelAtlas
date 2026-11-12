import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { OPENROUTER_BASE_URL, parseEndpointsResponse, parseModelsResponse } from "@/lib/openrouter";
import { getSampleModels, mergeSampleModels } from "@/lib/sample-data";
import type { Catalog, Model, ProviderListing } from "@/lib/types";

/*
 * Server-only data access. The public OpenRouter endpoints need no API key.
 * "use cache" stores the result across requests; cacheLife("hours") means it is
 * refreshed in the background about once an hour. If the API fails we serve the
 * sample models, cached for minutes only so we recover quickly.
 */

const FETCH_TIMEOUT_MS = 8_000;

export async function getCatalog(): Promise<Catalog> {
  "use cache";
  cacheTag("models");

  try {
    const res = await fetch(`${OPENROUTER_BASE_URL}/models`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`OpenRouter responded ${res.status}`);
    const live = parseModelsResponse(await res.json());
    if (live.length === 0) throw new Error("OpenRouter returned no models");

    cacheLife("hours");
    return { models: mergeSampleModels(live), fetchedAt: new Date().toISOString(), status: "live" };
  } catch (error) {
    console.error("[data] OpenRouter models fetch failed, using sample data:", error);
    cacheLife("minutes");
    return { models: getSampleModels(), fetchedAt: new Date().toISOString(), status: "fallback" };
  }
}

export async function listModels(): Promise<Model[]> {
  return (await getCatalog()).models;
}

export async function getModel(id: string): Promise<Model | undefined> {
  return (await listModels()).find((m) => m.id === id);
}

/**
 * Hosting providers for one model (OpenRouter /endpoints). Sample-only models
 * fall back to the provider names in the sample JSON. Never throws: the detail
 * page treats providers as optional.
 */
export async function getProviders(model: Model): Promise<ProviderListing[]> {
  "use cache";
  cacheTag("providers");

  const fromSample = (): ProviderListing[] =>
    model.providers.map((name) => ({ name, inputPrice: null, outputPrice: null, context: null, quantization: null }));

  if (model.source === "sample") {
    cacheLife("hours");
    return fromSample();
  }

  try {
    // Ids contain a slash ("openai/gpt-6.1-terra"); encode each part, keep the slash.
    const path = model.id.split("/").map(encodeURIComponent).join("/");
    const res = await fetch(`${OPENROUTER_BASE_URL}/models/${path}/endpoints`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`OpenRouter responded ${res.status}`);
    cacheLife("hours");
    return parseEndpointsResponse(await res.json());
  } catch (error) {
    console.error(`[data] endpoints fetch failed for ${model.id}:`, error);
    cacheLife("minutes");
    return fromSample();
  }
}
