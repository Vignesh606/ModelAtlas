import type { ApiErrorCode } from "@/lib/api-error";

/**
 * Maps a provider error status to our normalized error, with a message a
 * user can act on. Statuses follow common provider conventions:
 * 400 bad request, 401 bad key, 402 no credits, 403 moderation, 408 timeout,
 * 429 rate limited, 502 model down, 503 no provider available.
 */
export function mapUpstreamError(
  status: number,
  upstreamMessage: string | null,
  usingUserKey: boolean,
  providerName = "Google",
): { code: ApiErrorCode; status: number; message: string } {
  const detail = upstreamMessage ? ` (${upstreamMessage.slice(0, 200)})` : "";
  switch (status) {
    case 400:
    case 404: // OpenAI-style "model not found"
    case 422: // validation error (Mistral)
      return { code: "invalid_request", status: 400, message: `The model rejected the request${detail}.` };
    case 401:
      return usingUserKey
        ? { code: "unauthorized", status: 401, message: `Your ${providerName} API key was rejected. Check it in Settings.` }
        : {
            code: "unauthorized",
            status: 401,
            message: `The server's ${providerName} key was rejected. Add your own key in Settings to continue.`,
          };
    case 402:
      return {
        code: "payment_required",
        status: 402,
        message: usingUserKey
          ? `Your ${providerName} account is out of credits.`
          : "The shared key is out of credits. Pick a free model or add your own key in Settings.",
      };
    case 403:
      // Forbidden: moderation, a guardrail, or a model restricted to certain apps.
      return { code: "invalid_request", status: 400, message: `This model refused the request${detail}. Try another model.` };
    case 408:
      return { code: "timeout", status: 504, message: "The model took too long to respond. Try again." };
    case 429:
      // A daily cap applies to some free models until it resets.
      if (upstreamMessage && /per[-\s]?day/i.test(upstreamMessage)) {
        return {
          code: "rate_limited",
          status: 429,
          message: usingUserKey
            ? `Your ${providerName} account has used today's free-model allowance. Add credits or try again tomorrow.`
            : `The shared key has used today's free-model allowance. Add your own API key in Settings, or try again tomorrow.`,
        };
      }
      return {
        code: "rate_limited",
        status: 429,
        message: "This model is rate-limited right now. Wait a moment or try another model.",
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
    let body: unknown = await response.json();
    if (Array.isArray(body)) body = body[0]; // Gemini wraps errors in an array
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
