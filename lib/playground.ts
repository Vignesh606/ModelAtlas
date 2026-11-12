import { z } from "zod";
import { isFree } from "@/lib/catalog";
import { PROVIDERS, type ProviderId } from "@/lib/providers";
import { toSummary } from "@/lib/summary";
import type { Model, ModelSummary } from "@/lib/types";

/**
 * What the playground needs per model: the summary, the parameters it accepts,
 * and where to send it. `id` is unique across providers ("openai:gpt-4o");
 * `upstreamId` is what the provider itself calls the model ("gpt-4o").
 */
export type ChatModel = ModelSummary & { supportedParameters: string[]; provider: ProviderId; upstreamId: string };

/** Converts an OpenRouter catalog Model to a ChatModel. */
export function toChatModel(model: Model): ChatModel {
  return { ...toSummary(model), supportedParameters: model.supportedParameters, provider: "openrouter", upstreamId: model.id };
}

/** Lenient shape of a provider's GET /models reply: `{ data: [...] }` or a bare array (Together). */
const providerModelsSchema = z.union([
  z.object({ data: z.array(z.unknown()) }).transform((r) => r.data),
  z.array(z.unknown()),
]);
const providerModelSchema = z.object({
  id: z.string(),
  display_name: z.string().nullish(), // Anthropic
  type: z.string().nullish(), // Together: "chat", "embedding"...
  context_length: z.number().nullish(),
  context_window: z.number().nullish(), // Groq
});

/** Ids that are clearly not chat models (embeddings, speech, images...). */
const NOT_CHAT = /embed|whisper|tts|dall-e|moderation|image|audio|transcribe|rerank|realtime|guard|live|lyria|aqa|banana|robotics|research|computer-use|antigravity/i;

/**
 * Turns a provider's /models list into playground models. Other providers
 * publish no prices or benchmarks, so those stay null (no cost projection).
 */
export function parseProviderModels(provider: ProviderId, body: unknown): ChatModel[] {
  const list = providerModelsSchema.safeParse(body);
  if (!list.success) return [];
  const models: ChatModel[] = [];
  for (const item of list.data) {
    const parsed = providerModelSchema.safeParse(item);
    if (!parsed.success) continue;
    const raw = parsed.data;
    const upstreamId = raw.id.replace(/^models\//, ""); // Gemini prefixes ids with "models/"
    if (NOT_CHAT.test(upstreamId) || (raw.type && !/chat|language/.test(raw.type))) continue;
    models.push({
      id: `${provider}:${upstreamId}`,
      upstreamId,
      provider,
      name: raw.display_name ?? upstreamId,
      lab: provider,
      labName: PROVIDERS[provider].name,
      context: raw.context_length ?? raw.context_window ?? null,
      maxOutput: null,
      input: ["text"],
      output: ["text"],
      pricing: { input: null, output: null, cacheRead: null, cacheWrite: null },
      releasedAt: null,
      expiresAt: null,
      capabilities: { reasoning: false, tools: false, vision: false, openWeights: false },
      supportedParameters: ["temperature", "max_tokens"],
      benchmarks: { intelligence: null, coding: null, agentic: null },
      providers: [],
      source: "live",
    });
  }
  return models.sort((a, b) => a.name.localeCompare(b.name));
}

/** Models the playground can call: live on OpenRouter and able to output text. */
export function isChatModel(model: Model): boolean {
  return model.source === "live" && model.output.includes("text");
}

/**
 * Default Gemini models that work out of the box with a Gemini API key.
 * These are used when Gemini is the primary provider and no other API keys
 * are configured. The first one found is selected as default.
 */
export const DEFAULT_GEMINI_MODELS = [
  "gemini:gemini-2.5-flash",
  "gemini:gemini-2.5-pro",
  "gemini:gemini-2.0-flash",
] as const;

/**
 * OpenRouter free model fallbacks, used only when OpenRouter is configured
 * and the user hasn't set up any other provider.
 */
export const DEFAULT_FREE_MODELS = [
  "nvidia/nemotron-3.5-super-vl:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "openrouter/free",
] as const;

/**
 * Default model: picks the best model based on what's available.
 *
 * Priority:
 * 1. Explicit preferred ids (env override, then built-in defaults)
 * 2. Best-scoring free model (newest as tie-break)
 * 3. Any available model
 *
 * Models from providers with configured API keys (server-keyed providers)
 * appear at the top of the list so they're selected first when no explicit
 * preference is given.
 */
export function pickDefaultModel<T extends ModelSummary>(
  models: T[],
  preferredIds: ReadonlyArray<string | undefined> = DEFAULT_GEMINI_MODELS,
): T | undefined {
  for (const id of preferredIds) {
    const preferred = id ? models.find((m) => m.id === id) : undefined;
    if (preferred) return preferred;
  }

  const free = models.filter(isFree);
  const pool = free.length ? free : models;
  return [...pool].sort((a, b) => {
    const scoreDiff = (b.benchmarks.intelligence?.value ?? -1) - (a.benchmarks.intelligence?.value ?? -1);
    if (scoreDiff !== 0) return scoreDiff;
    return (b.releasedAt ?? "").localeCompare(a.releasedAt ?? "");
  })[0];
}

/**
 * Orders models so that models from providers with configured API keys
 * appear first, followed by catalog (OpenRouter) models. Within each group,
 * the primary provider's models come first.
 */
export function orderModels(
  providerModels: ChatModel[],
  catalogModels: ChatModel[],
  serverProviders: ProviderId[],
): ChatModel[] {
  // Provider models first (ordered by provider priority), then catalog models.
  const providerOrder = new Map(serverProviders.map((p, i) => [p, i]));
  const sortedProviderModels = [...providerModels].sort((a, b) => {
    const aOrder = providerOrder.get(a.provider) ?? 999;
    const bOrder = providerOrder.get(b.provider) ?? 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    const defaultId = PROVIDERS[a.provider].defaultModel;
    if (defaultId) {
      if (a.upstreamId === defaultId && b.upstreamId !== defaultId) return -1;
      if (b.upstreamId === defaultId && a.upstreamId !== defaultId) return 1;
    }
    return a.name.localeCompare(b.name);
  });
  return [...sortedProviderModels, ...catalogModels];
}
