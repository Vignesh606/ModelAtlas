import { after, type NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { USER_KEY_HEADER, chatRequestSchema, firstIssue, type ChatRequest } from "@/lib/chat";
import { mapUpstreamError, readUpstreamErrorMessage } from "@/lib/chat-errors";
import { createChatStream, type CompletionRecord } from "@/lib/chat-stream";
import { getModel } from "@/lib/data";
import { getServerEnv } from "@/lib/env";
import { saveRequest, type SaveRequestInput } from "@/lib/history";
import { PROVIDERS, authHeaders, isValidKey, type ProviderId } from "@/lib/providers";
import { checkRateLimit } from "@/lib/rate-limit";
import { getOrCreateSessionId } from "@/lib/session";

/**
 * POST /api/chat: validates the request, calls the chosen provider (OpenRouter
 * by default, or any preset in lib/providers.ts) with streaming, and
 * relays a normalized SSE stream (see lib/chat.ts for the contract).
 *
 * Errors before streaming starts return { error: { code, message } } with a
 * real status code: 400 invalid, 401 bad key, 402 no credits, 429 rate limited,
 * 502 provider failure, 504 timeout. Errors after streaming starts can't change
 * the status (200 is already sent), so they arrive as an `error` event.
 *
 * Keys: the server key (OpenRouter only) comes from env; a user's own key comes per request in
 * a header and is used only for that upstream call: never stored or logged.
 */

export const maxDuration = 60; // seconds; Vercel uses this as the function limit
const UPSTREAM_TIMEOUT_MS = 55_000; // a little under maxDuration so we can report the timeout
const RATE_LIMIT_WINDOW_MS = 60_000;
const SESSION_LIMIT = 12; // requests per minute per browser session
const IP_LIMIT = 40; // per IP, so clearing cookies doesn't bypass the limit

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no", // disable proxy buffering so tokens arrive immediately
};

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  // 1. Session + rate limits (cookie must be set before the body starts streaming).
  const sessionId = await getOrCreateSessionId();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  for (const [key, limit] of [
    [`session:${sessionId}`, SESSION_LIMIT],
    [`ip:${ip}`, IP_LIMIT],
  ] as const) {
    const result = checkRateLimit(key, limit, RATE_LIMIT_WINDOW_MS);
    if (!result.ok) {
      return apiError("rate_limited", `Too many requests. Try again in ${result.retryAfterSec}s.`, 429, {
        "Retry-After": String(result.retryAfterSec),
      });
    }
  }

  // 2. Validate the body.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_request", "The request body must be valid JSON.", 400);
  }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) return apiError("invalid_request", firstIssue(parsed.error), 400);

  const { provider } = parsed.data;
  const providerName = PROVIDERS[provider].name;

  // OpenRouter models must exist in the catalog (we know their parameters).
  // Other providers' models were listed by the provider itself, so we trust the id.
  let supportedParameters = ["temperature", "max_tokens"];
  if (provider === "openrouter") {
    const model = await getModel(parsed.data.model);
    if (!model || model.source !== "live") {
      return apiError("invalid_request", `'${parsed.data.model}' is not an available model.`, 400);
    }
    supportedParameters = model.supportedParameters;
  }
  // History id: catalog id for OpenRouter, "provider:model" otherwise.
  const historyModelId = provider === "openrouter" ? parsed.data.model : `${provider}:${parsed.data.model}`;

  // 3. Choose the key: the user's own (header) or the server's (env).
  const userKey = request.headers.get(USER_KEY_HEADER)?.trim() || null;
  if (userKey && !isValidKey(provider, userKey)) {
    return apiError("invalid_request", `That doesn't look like a ${providerName} API key.`, 400);
  }
  const apiKey = userKey ?? (provider === "openrouter" ? getServerEnv().env.OPENROUTER_API_KEY : undefined);
  if (!apiKey) {
    return apiError("unauthorized", `Add your ${providerName} API key in Settings to use this model.`, 401);
  }

  // 4. Call the provider. Abort on our timeout or when the client disconnects (Stop button).
  const timeout = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
  const signal = AbortSignal.any([request.signal, timeout]);

  // History: every request that reaches a model is recorded (success, error or
  // aborted). after() runs once the response has finished and keeps the
  // serverless function alive until the write completes.
  const prompt = parsed.data.messages.at(-1)?.content ?? "";
  const record = (fields: Pick<SaveRequestInput, "response" | "usage" | "latencyMs" | "status" | "errorMessage">) =>
    saveRequest({ sessionId, model: historyModelId, prompt, ...fields });
  const recordFailure = (message: string) =>
    after(() => record({ response: "", usage: null, latencyMs: Date.now() - startedAt, status: "error", errorMessage: message }));

  let upstream: Response;
  try {
    upstream = await fetch(`${PROVIDERS[provider].baseUrl}/chat/completions`, {
      method: "POST",
      signal,
      headers: {
        ...authHeaders(provider, apiKey),
        "Content-Type": "application/json",
        ...(provider === "openrouter" ? { "X-Title": "ModelAtlas" } : {}),
      },
      body: JSON.stringify(buildUpstreamBody(parsed.data, provider, supportedParameters)),
    });
  } catch {
    if (timeout.aborted) {
      recordFailure("Timed out before the model responded.");
      return apiError("timeout", "The model took too long to respond. Try again.", 504);
    }
    if (request.signal.aborted) return new Response(null, { status: 499 }); // client closed request
    recordFailure(`Couldn't reach ${providerName}.`);
    return apiError("upstream_error", `Couldn't reach ${providerName}. Try again in a moment.`, 502);
  }

  if (!upstream.ok || !upstream.body) {
    const mapped = mapUpstreamError(upstream.status, await readUpstreamErrorMessage(upstream), Boolean(userKey), providerName);
    recordFailure(mapped.message);
    const retryAfter = upstream.headers.get("retry-after");
    return apiError(mapped.code, mapped.message, mapped.status, retryAfter ? { "Retry-After": retryAfter } : undefined);
  }

  // 5. Relay as our normalized SSE stream. The stream resolves `completed`
  // when it ends (in every case: done, error, timeout or client abort).
  let resolveCompleted: (record: CompletionRecord) => void = () => {};
  const completed = new Promise<CompletionRecord>((resolve) => {
    resolveCompleted = resolve;
  });
  after(async () => {
    const r = await completed;
    await record({ response: r.text, usage: r.usage, latencyMs: r.latencyMs, status: r.status, errorMessage: r.errorMessage });
  });

  const stream = createChatStream(upstream.body, {
    startedAt,
    isTimedOut: () => timeout.aborted,
    onComplete: resolveCompleted,
  });
  return new Response(stream, { headers: SSE_HEADERS });
}

/** Only sends parameters the model supports; unsupported ones are dropped silently. */
function buildUpstreamBody(request: ChatRequest, provider: ProviderId, supportedParameters: string[]) {
  const supports = (param: string) => supportedParameters.includes(param);
  const { streamUsage, maxTokensField = "max_tokens" } = PROVIDERS[provider];
  const messages = [
    ...(request.system?.trim() ? [{ role: "system" as const, content: request.system.trim() }] : []),
    ...request.messages,
  ];
  return {
    model: request.model,
    stream: true,
    // Most providers only report token usage in the stream when asked.
    ...(streamUsage ? { stream_options: { include_usage: true } } : {}),
    messages,
    ...(request.temperature !== undefined && supports("temperature") ? { temperature: request.temperature } : {}),
    ...(request.maxTokens !== undefined && supports("max_tokens") ? { [maxTokensField]: request.maxTokens } : {}),
  };
}
