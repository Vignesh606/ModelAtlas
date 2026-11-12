import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { USER_KEY_HEADER } from "@/lib/chat";
import { mapUpstreamError, readUpstreamErrorMessage } from "@/lib/chat-errors";
import { parseProviderModels } from "@/lib/playground";
import { PROVIDER_IDS, PROVIDERS, authHeaders, isValidKey } from "@/lib/providers";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/provider-models?provider=openai  (key in the x-provider-key header)
 * -> { models: ChatModel[] }
 *
 * Lists the chat models the user's key can use on another provider. The key is
 * only forwarded to that provider's fixed base URL, never stored or logged.
 * OpenRouter isn't listed here: its models come from the catalog.
 */
const querySchema = z.object({ provider: z.enum(PROVIDER_IDS).exclude(["openrouter"]) });

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({ provider: request.nextUrl.searchParams.get("provider") });
  if (!parsed.success) return apiError("invalid_request", "Unknown provider.", 400);
  const { provider } = parsed.data;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = checkRateLimit(`models:${ip}`, 10, 60_000);
  if (!limit.ok) return apiError("rate_limited", `Too many requests. Try again in ${limit.retryAfterSec}s.`, 429);

  const key = request.headers.get(USER_KEY_HEADER)?.trim() ?? "";
  if (!isValidKey(provider, key)) {
    return apiError("invalid_request", `Paste a valid ${PROVIDERS[provider].name} API key first.`, 400);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${PROVIDERS[provider].baseUrl}/models`, {
      headers: authHeaders(provider, key),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch {
    return apiError("upstream_error", `Couldn't reach ${PROVIDERS[provider].name}. Try again.`, 502);
  }
  if (!upstream.ok) {
    const mapped = mapUpstreamError(upstream.status, await readUpstreamErrorMessage(upstream), true, PROVIDERS[provider].name);
    return apiError(mapped.code, mapped.message, mapped.status);
  }

  const models = parseProviderModels(provider, await upstream.json().catch(() => null));
  return Response.json({ models }, { headers: { "Cache-Control": "no-store" } });
}
