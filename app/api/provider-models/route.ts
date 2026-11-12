import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { USER_KEY_HEADER } from "@/lib/chat";
import { serverKeyFor } from "@/lib/env";
import { fetchProviderModels } from "@/lib/provider-models";
import { PROVIDER_IDS, PROVIDERS, isValidKey } from "@/lib/providers";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/provider-models?provider=openai  (optional key in the x-provider-key header)
 * -> { models: ChatModel[] }
 *
 * Lists the chat models a key can use on a provider: the user's key if
 * sent, else the server's key for that provider. Keys go only to the
 * provider's fixed base URL and are never stored or logged.
 */
const querySchema = z.object({ provider: z.enum(PROVIDER_IDS) });

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({ provider: request.nextUrl.searchParams.get("provider") });
  if (!parsed.success) return apiError("invalid_request", "Unknown provider.", 400);
  const { provider } = parsed.data;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = checkRateLimit(`models:${ip}`, 10, 60_000);
  if (!limit.ok) return apiError("rate_limited", `Too many requests. Try again in ${limit.retryAfterSec}s.`, 429);

  const userKey = request.headers.get(USER_KEY_HEADER)?.trim() || null;
  if (userKey && !isValidKey(provider, userKey)) {
    return apiError("invalid_request", `That doesn't look like a ${PROVIDERS[provider].name} API key.`, 400);
  }
  const key = userKey ?? serverKeyFor(provider);
  if (!key) return apiError("invalid_request", `Paste a ${PROVIDERS[provider].name} API key first.`, 400);

  const result = await fetchProviderModels(provider, key, Boolean(userKey));
  if ("error" in result) return apiError(result.error.code, result.error.message, result.error.status);
  return Response.json({ models: result.models }, { headers: { "Cache-Control": "no-store" } });
}
