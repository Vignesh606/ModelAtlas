import { after, type NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { USER_KEY_HEADER, chatRequestSchema, firstIssue, userKeySchema, type ChatRequest } from "@/lib/chat";
import { mapUpstreamError, readUpstreamErrorMessage } from "@/lib/chat-errors";
import { createChatStream, type CompletionRecord } from "@/lib/chat-stream";
import { getModel } from "@/lib/data";
import { getServerEnv } from "@/lib/env";
import { saveRequest, type SaveRequestInput } from "@/lib/history";
import { OPENROUTER_BASE_URL } from "@/lib/openrouter";
import { checkRateLimit } from "@/lib/rate-limit";
import { getOrCreateSessionId } from "@/lib/session";
import type { Model } from "@/lib/types";

/**
 * POST /api/chat: validates the request, calls OpenRouter with streaming, and
 * relays a normalized SSE stream (see lib/chat.ts for the contract).
 *
 * Errors before streaming starts return { error: { code, message } } with a
 * real status code: 400 invalid, 401 bad key, 402 no credits, 429 rate limited,
 * 502 provider failure, 504 timeout. Errors after streaming starts can't change
 * the status (200 is already sent), so they arrive as an `error` event.
 *
 * Keys: the server key comes from env; a user's own key comes per request in
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

  const model = await getModel(parsed.data.model);
  if (!model || model.source !== "live") {
    return apiError("invalid_request", `'${parsed.data.model}' is not an available model.`, 400);
  }

  // 3. Choose the key: the user's own (header) or the server's (env).
  const userKey = request.headers.get(USER_KEY_HEADER)?.trim() || null;
  if (userKey && !userKeySchema.safeParse(userKey).success) {
    return apiError("invalid_request", "That doesn't look like an OpenRouter key (it should start with sk-or-).", 400);
  }
  const apiKey = userKey ?? getServerEnv().env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return apiError("unauthorized", "The server has no OpenRouter key configured. Add your own key in Settings.", 401);
  }

  // 4. Call OpenRouter. Abort on our timeout or when the client disconnects (Stop button).
  const timeout = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
  const signal = AbortSignal.any([request.signal, timeout]);

  // History: every request that reaches a model is recorded (success, error or
  // aborted). after() runs once the response has finished and keeps the
  // serverless function alive until the write completes.
  const prompt = parsed.data.messages.at(-1)?.content ?? "";
  const record = (fields: Pick<SaveRequestInput, "response" | "usage" | "latencyMs" | "status" | "errorMessage">) =>
    saveRequest({ sessionId, model: model.id, prompt, ...fields });
  const recordFailure = (message: string) =>
    after(() => record({ response: "", usage: null, latencyMs: Date.now() - startedAt, status: "error", errorMessage: message }));

  let upstream: Response;
  try {
    upstream = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "ModelAtlas",
      },
      body: JSON.stringify(buildUpstreamBody(parsed.data, model)),
    });
  } catch {
    if (timeout.aborted) {
      recordFailure("Timed out before the model responded.");
      return apiError("timeout", "The model took too long to respond. Try again.", 504);
    }
    if (request.signal.aborted) return new Response(null, { status: 499 }); // client closed request
    recordFailure("Couldn't reach OpenRouter.");
    return apiError("upstream_error", "Couldn't reach OpenRouter. Try again in a moment.", 502);
  }

  if (!upstream.ok || !upstream.body) {
    const mapped = mapUpstreamError(upstream.status, await readUpstreamErrorMessage(upstream), Boolean(userKey));
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
function buildUpstreamBody(request: ChatRequest, model: Model) {
  const supports = (param: string) => model.supportedParameters.includes(param);
  const messages = [
    ...(request.system?.trim() ? [{ role: "system" as const, content: request.system.trim() }] : []),
    ...request.messages,
  ];
  return {
    model: model.id,
    stream: true,
    messages,
    ...(request.temperature !== undefined && supports("temperature") ? { temperature: request.temperature } : {}),
    ...(request.maxTokens !== undefined && supports("max_tokens") ? { max_tokens: request.maxTokens } : {}),
  };
}
