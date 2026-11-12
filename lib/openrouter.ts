import { z } from "zod";
import type { Benchmarks, Modality, Model, ProviderListing } from "@/lib/types";

/*
 * OpenRouter -> Model mapping. Pure functions only (no fetch) so it is easy to
 * unit-test. Schemas are deliberately lenient: unknown fields are ignored and
 * optional fields are nullable, because a public API can add or drop fields.
 */

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const priceString = z.string().nullish(); // prices arrive as strings, e.g. "0.000001"

const rawModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  created: z.number().nullish(),
  context_length: z.number().nullish(),
  hugging_face_id: z.string().nullish(),
  architecture: z
    .object({
      input_modalities: z.array(z.string()).nullish(),
      output_modalities: z.array(z.string()).nullish(),
    })
    .nullish(),
  pricing: z
    .object({
      prompt: priceString,
      completion: priceString,
      input_cache_read: priceString,
      input_cache_write: priceString,
    })
    .nullish(),
  top_provider: z.object({ max_completion_tokens: z.number().nullish() }).nullish(),
  supported_parameters: z.array(z.string()).nullish(),
  expiration_date: z.string().nullish(),
  alias_target: z.unknown().optional(),
  benchmarks: z
    .object({
      artificial_analysis: z
        .object({
          intelligence_index: z.number().nullish(),
          coding_index: z.number().nullish(),
          agentic_index: z.number().nullish(),
        })
        .nullish(),
    })
    .nullish(),
});

export type RawOpenRouterModel = z.infer<typeof rawModelSchema>;

/** Only checks the envelope; each model is validated separately so one bad entry can't drop the whole list. */
export const modelsResponseSchema = z.object({ data: z.array(z.unknown()) });

/**
 * "$ per token" string -> "$ per 1M tokens" number.
 * Negative values (OpenRouter uses -1 for router models with variable
 * pricing) and unparseable values become null. Rounded to 6 decimals to remove
 * float noise (0.000001 * 1e6 would otherwise give 0.9999999999999999).
 */
export function perTokenToPerMillion(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const perToken = Number(value);
  if (!Number.isFinite(perToken) || perToken < 0) return null;
  return Math.round(perToken * 1e6 * 1e6) / 1e6;
}

const MODALITY_MAP: Record<string, Modality> = {
  text: "text",
  image: "image",
  audio: "audio",
  video: "video",
  file: "pdf",
};

function toModalities(values: string[] | null | undefined): Modality[] {
  const mapped = (values ?? []).flatMap((v) => (MODALITY_MAP[v] ? [MODALITY_MAP[v]] : []));
  // Stable display order, no duplicates.
  const order: Modality[] = ["text", "image", "pdf", "audio", "video"];
  return order.filter((m) => mapped.includes(m));
}

/** "OpenAI: GPT-6.1 Terra" -> { labName: "OpenAI", name: "GPT-6.1 Terra" } */
export function splitDisplayName(fullName: string, labSlug: string): { labName: string; name: string } {
  const colon = fullName.indexOf(": ");
  if (colon > 0) {
    return { labName: fullName.slice(0, colon), name: fullName.slice(colon + 2) };
  }
  return { labName: labSlug, name: fullName };
}

function toIsoDate(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

function toBenchmarks(raw: RawOpenRouterModel["benchmarks"]): Benchmarks {
  const aa = raw?.artificial_analysis;
  const score = (value: number | null | undefined) =>
    typeof value === "number" ? { value, source: "artificial-analysis" as const } : null;
  return {
    intelligence: score(aa?.intelligence_index),
    coding: score(aa?.coding_index),
    agentic: score(aa?.agentic_index),
  };
}

export function mapOpenRouterModel(raw: RawOpenRouterModel): Model {
  const lab = raw.id.split("/")[0] ?? raw.id;
  const { labName, name } = splitDisplayName(raw.name, lab);
  const input = toModalities(raw.architecture?.input_modalities);
  const params = raw.supported_parameters ?? [];

  return {
    id: raw.id,
    name,
    lab,
    labName,
    description: raw.description ?? "",
    context: raw.context_length ?? null,
    maxOutput: raw.top_provider?.max_completion_tokens ?? null,
    input,
    output: toModalities(raw.architecture?.output_modalities),
    pricing: {
      input: perTokenToPerMillion(raw.pricing?.prompt),
      output: perTokenToPerMillion(raw.pricing?.completion),
      cacheRead: perTokenToPerMillion(raw.pricing?.input_cache_read),
      cacheWrite: perTokenToPerMillion(raw.pricing?.input_cache_write),
    },
    releasedAt: toIsoDate(raw.created),
    expiresAt: raw.expiration_date ?? null,
    capabilities: {
      reasoning: params.includes("reasoning") || params.includes("include_reasoning"),
      tools: params.includes("tools"),
      vision: input.includes("image"),
      openWeights: Boolean(raw.hugging_face_id),
    },
    supportedParameters: params,
    benchmarks: toBenchmarks(raw.benchmarks),
    providers: [],
    source: "live",
  };
}

/**
 * Parses the /models payload. Invalid entries and aliases (ids like
 * "~vendor/model-latest" that duplicate another model) are skipped.
 */
export function parseModelsResponse(json: unknown): Model[] {
  const { data } = modelsResponseSchema.parse(json);
  const models: Model[] = [];
  for (const entry of data) {
    const parsed = rawModelSchema.safeParse(entry);
    if (!parsed.success || parsed.data.alias_target) continue;
    models.push(mapOpenRouterModel(parsed.data));
  }
  return models;
}

const endpointsResponseSchema = z.object({
  data: z.object({
    endpoints: z.array(
      z.object({
        provider_name: z.string(),
        context_length: z.number().nullish(),
        quantization: z.string().nullish(),
        pricing: z.object({ prompt: priceString, completion: priceString }).nullish(),
      }),
    ),
  }),
});

/** Parses /models/{id}/endpoints into one listing per provider (cheapest endpoint kept). */
export function parseEndpointsResponse(json: unknown): ProviderListing[] {
  const { endpoints } = endpointsResponseSchema.parse(json).data;
  const byProvider = new Map<string, ProviderListing>();

  for (const e of endpoints) {
    const listing: ProviderListing = {
      name: e.provider_name,
      inputPrice: perTokenToPerMillion(e.pricing?.prompt),
      outputPrice: perTokenToPerMillion(e.pricing?.completion),
      context: e.context_length ?? null,
      quantization: e.quantization && e.quantization !== "unknown" ? e.quantization : null,
    };
    const current = byProvider.get(listing.name);
    // A provider can expose several endpoints (e.g. flex/standard tiers); keep the cheapest.
    if (!current || (listing.inputPrice ?? Infinity) < (current.inputPrice ?? Infinity)) {
      byProvider.set(listing.name, listing);
    }
  }
  return [...byProvider.values()];
}
