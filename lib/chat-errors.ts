import type { ApiErrorCode } from "@/lib/api-error";

/**
 * Maps an OpenRouter error status to our normalized error, with a message a
 * user can act on. Statuses follow OpenRouter's documented meanings:
 * 400 bad request, 401 bad key, 402 no credits, 403 moderation, 408 timeout,
 * 429 rate limited, 502 model down, 503 no provider available.
 */
export function mapUpstreamError(
  status: number,
  upstreamMessage: string | null,
  usingUserKey: boolean,
): { code: ApiErrorCode; status: number; message: string } {
  const detail = upstreamMessage ? ` (${upstreamMessage.slice(0, 200)})` : "";
  switch (status) {
    case 400:
      return { code: "invalid_request", status: 400, message: `The model rejected the request${detail}.` };
    case 401:
      return usingUserKey
        ? { code: "unauthorized", status: 401, message: "Your OpenRouter API key was rejected. Check it in Settings." }
        : {
            code: "unauthorized",
            status: 401,
            message: "The server's OpenRouter key was rejected. Add your own key in Settings to continue.",
          };
    case 402:
      return {
        code: "payment_required",
        status: 402,
        message: usingUserKey
          ? "Your OpenRouter account is out of credits. Add credits or pick a free model."
          : "The shared key is out of credits. Pick a free model or add your own key in Settings.",
      };
    case 403:
      // Forbidden: moderation, a guardrail, or a model restricted to certain apps.
      return { code: "invalid_request", status: 400, message: `This model refused the request${detail}. Try another model.` };
    case 408:
      return { code: "timeout", status: 504, message: "The model took too long to respond. Try again." };
    case 429:
      // A daily cap applies to every free model until it resets, so "try another model" wouldn't help.
      if (upstreamMessage && /per[-\s]?day/i.test(upstreamMessage)) {
        return {
          code: "rate_limited",
          status: 429,
          message: usingUserKey
            ? "Your OpenRouter account has used today's free-model allowance. Add credits or try again tomorrow."
            : "The shared key has used today's free-model allowance. Add your own OpenRouter key in Settings, or try again tomorrow.",
        };
      }
      return {
        code: "rate_limited",
        status: 429,
        message: "This model is rate-limited right now (free models have tight limits). Wait a moment or try another model.",
      };
    default:
      return {
        code: "upstream_error",
        status: 502,
        message: "The model provider failed to respond. Try again, or pick another model.",
      };
  }
}

/** Reads `{ error: { message } }` from an upstream error body, tolerating non-JSON bodies. */
export async function readUpstreamErrorMessage(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "error" in body) {
      const error = (body as { error: unknown }).error;
      if (typeof error === "object" && error !== null && "message" in error) {
        const message = (error as { message: unknown }).message;
        return typeof message === "string" ? message : null;
      }
    }
  } catch {
    // Not JSON: fall through.
  }
  return null;
}
