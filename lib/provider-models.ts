import "server-only";
import type { ApiErrorCode } from "@/lib/api-error";
import { mapUpstreamError, readUpstreamErrorMessage } from "@/lib/chat-errors";
import { parseProviderModels, type ChatModel } from "@/lib/playground";
import { PROVIDERS, authHeaders, type ProviderId } from "@/lib/providers";

type Result = { models: ChatModel[] } | { error: { code: ApiErrorCode; message: string; status: number } };

/** Fetches the chat models a key can use on a provider (its GET /models). */
export async function fetchProviderModels(provider: ProviderId, key: string, usingUserKey: boolean): Promise<Result> {
  const { name, baseUrl } = PROVIDERS[provider];
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/models`, { headers: authHeaders(provider, key), signal: AbortSignal.timeout(10_000), cache: "no-store" });
  } catch {
    return { error: { code: "upstream_error", message: `Couldn't reach ${name}. Try again.`, status: 502 } };
  }
  if (!res.ok) return { error: mapUpstreamError(res.status, await readUpstreamErrorMessage(res), usingUserKey, name) };
  return { models: parseProviderModels(provider, await res.json().catch(() => null)) };
}
