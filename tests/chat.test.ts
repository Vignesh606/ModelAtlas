import { beforeEach, describe, expect, it } from "vitest";
import { CHAT_LIMITS, chatRequestSchema, type ChatEvent } from "@/lib/chat";
import { mapUpstreamError } from "@/lib/chat-errors";
import { createChatStream, type CompletionRecord } from "@/lib/chat-stream";
import { projectMonthlyCost } from "@/lib/cost";
import { orderModels, parseProviderModels, pickDefaultModel } from "@/lib/playground";
import { isValidKey } from "@/lib/providers";
import { checkRateLimit, resetRateLimits } from "@/lib/rate-limit";
import { getSampleModels } from "@/lib/sample-data";
import { createSseParser } from "@/lib/sse";

describe("createSseParser", () => {
  it("handles chunks split mid-line, comments and multiple events", () => {
    const events: string[] = [];
    const parser = createSseParser((d) => events.push(d));
    parser.push(": OPENROUTER PROCESSING\n\nda");
    parser.push('ta: {"a":1}\n');
    parser.push("\ndata: [DONE]\n\n");
    expect(events).toEqual(['{"a":1}', "[DONE]"]);
  });

  it("accepts CRLF and data without a space, and flushes a trailing event", () => {
    const events: string[] = [];
    const parser = createSseParser((d) => events.push(d));
    parser.push("data:x\r\n\r\ndata: y");
    parser.flush();
    expect(events).toEqual(["x", "y"]);
  });
});

describe("chatRequestSchema", () => {
  const valid = { model: "openai/gpt-6.1-terra", messages: [{ role: "user", content: "Hi" }] };

  it("accepts a valid request with optional parameters", () => {
    expect(chatRequestSchema.safeParse({ ...valid, system: "Be brief", temperature: 0.7, maxTokens: 256 }).success).toBe(true);
  });

  it.each([
    ["no messages", { ...valid, messages: [] }],
    ["last message from assistant", { ...valid, messages: [{ role: "user", content: "Hi" }, { role: "assistant", content: "Yo" }] }],
    ["blank last message", { ...valid, messages: [{ role: "user", content: "   " }] }],
    ["system role in messages", { ...valid, messages: [{ role: "system", content: "x" }] }],
    ["message too long", { ...valid, messages: [{ role: "user", content: "x".repeat(CHAT_LIMITS.maxMessageChars + 1) }] }],
    ["temperature out of range", { ...valid, temperature: 3 }],
    ["fractional maxTokens", { ...valid, maxTokens: 10.5 }],
    ["unknown field", { ...valid, apiKey: "sk-or-secret" }],
    ["missing model", { messages: valid.messages }],
  ])("rejects %s", (_, body) => {
    expect(chatRequestSchema.safeParse(body).success).toBe(false);
  });

  it("defaults the provider to Gemini and rejects unknown providers", () => {
    expect(chatRequestSchema.parse(valid).provider).toBe("gemini");
    expect(chatRequestSchema.safeParse({ ...valid, provider: "evil" }).success).toBe(false);
  });

  it("validates user key shape per provider", () => {
    expect(isValidKey("openrouter", "sk-or-v1-abcdef0123456789")).toBe(true);
    expect(isValidKey("openrouter", "sk-ant-123")).toBe(false);
    expect(isValidKey("openrouter", "sk-or-<script>")).toBe(false);
    expect(isValidKey("anthropic", "sk-ant-api03-abcdef0123456789")).toBe(true);
    expect(isValidKey("openai", "sk-proj abc")).toBe(false); // spaces never allowed
  });
});

describe("parseProviderModels", () => {
  it("reads {data} and bare-array lists, strips Gemini's prefix and skips non-chat models", () => {
    const gemini = parseProviderModels("gemini", { data: [{ id: "models/gemini-pro" }, { id: "models/text-embedding-004" }] });
    expect(gemini.map((m) => [m.id, m.upstreamId])).toEqual([["gemini:gemini-pro", "gemini-pro"]]);
    const together = parseProviderModels("together", [{ id: "a/chat", type: "chat", context_length: 8000 }, { id: "b/emb", type: "embedding" }]);
    expect(together).toHaveLength(1);
    expect(together[0]).toMatchObject({ provider: "together", context: 8000, pricing: { input: null } });
    expect(parseProviderModels("openai", "nonsense")).toEqual([]);
  });
});

describe("mapUpstreamError", () => {
  it.each([
    [400, "invalid_request", 400],
    [401, "unauthorized", 401],
    [402, "payment_required", 402],
    [403, "invalid_request", 400],
    [408, "timeout", 504],
    [429, "rate_limited", 429],
    [500, "upstream_error", 502],
    [502, "upstream_error", 502],
    [503, "upstream_error", 502],
  ])("maps upstream %i to %s/%i", (upstream, code, status) => {
    expect(mapUpstreamError(upstream, null, false)).toMatchObject({ code, status });
  });

  it("explains a daily free-model cap differently from a short rate limit", () => {
    const daily = mapUpstreamError(429, "Rate limit exceeded: free-models-per-day. Add 10 credits...", false);
    expect(daily).toMatchObject({ code: "rate_limited", status: 429 });
    expect(daily.message).toContain("today's free-model allowance");
    expect(mapUpstreamError(429, "Rate limit exceeded", false).message).toContain("Wait a moment");
  });

  it("tailors the 401 message to whose key failed", () => {
    expect(mapUpstreamError(401, null, true).message).toContain("Your Google API key");
    expect(mapUpstreamError(401, null, false).message).toContain("server's");
    expect(mapUpstreamError(401, null, true, "Groq").message).toContain("Your Groq API key");
  });
});

describe("checkRateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the limit, then reports when to retry", () => {
    const t0 = 1_000_000;
    expect(checkRateLimit("k", 2, 60_000, t0).ok).toBe(true);
    expect(checkRateLimit("k", 2, 60_000, t0 + 1000).ok).toBe(true);
    const blocked = checkRateLimit("k", 2, 60_000, t0 + 2000);
    expect(blocked).toMatchObject({ ok: false, retryAfterSec: 58 });
    expect(checkRateLimit("other", 2, 60_000, t0 + 2000).ok).toBe(true); // keys are independent
  });

  it("frees capacity as the window slides", () => {
    const t0 = 1_000_000;
    checkRateLimit("k", 1, 60_000, t0);
    expect(checkRateLimit("k", 1, 60_000, t0 + 59_999).ok).toBe(false);
    expect(checkRateLimit("k", 1, 60_000, t0 + 60_000).ok).toBe(true);
  });
});

/** Builds a fake upstream body from SSE text, split into awkward chunks. */
function fakeUpstream(sse: string, chunkSize = 7): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(sse);
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) return controller.close();
      controller.enqueue(bytes.slice(offset, offset + chunkSize));
      offset += chunkSize;
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  const parser = createSseParser((d) => events.push(JSON.parse(d) as ChatEvent));
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.push(decoder.decode(value, { stream: true }));
  }
  parser.flush();
  return events;
}

const chunk = (obj: object) => `data: ${JSON.stringify(obj)}\n\n`;

describe("createChatStream", () => {
  it("normalizes deltas, reasoning and the final usage chunk", async () => {
    const records: CompletionRecord[] = [];
    const upstream = fakeUpstream(
      ": OPENROUTER PROCESSING\n\n" +
        chunk({ choices: [{ delta: { reasoning: "Thinking..." } }] }) +
        chunk({ choices: [{ delta: { content: "Hello" } }] }) +
        chunk({ choices: [{ delta: { content: " world" }, finish_reason: "stop" }] }) +
        chunk({ choices: [{ delta: { content: "" }, finish_reason: "stop" }], usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15, cost: 0.0001 } }) +
        "data: [DONE]\n\n",
    );
    let t = 1000;
    const events = await collect(
      createChatStream(upstream, { startedAt: 1000, isTimedOut: () => false, now: () => (t += 250), onComplete: (r) => void records.push(r) }),
    );

    expect(events.filter((e) => e.type === "delta").map((e) => (e.type === "delta" ? e.text : ""))).toEqual(["Hello", " world"]);
    expect(events[0]).toEqual({ type: "reasoning", text: "Thinking..." });
    const done = events.at(-1);
    expect(done).toMatchObject({ type: "done", finishReason: "stop", usage: { promptTokens: 12, completionTokens: 3, totalTokens: 15, cost: 0.0001 } });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ status: "success", text: "Hello world", errorMessage: null });
  });

  it("turns a mid-stream error chunk into an error event", async () => {
    const records: CompletionRecord[] = [];
    const upstream = fakeUpstream(
      chunk({ choices: [{ delta: { content: "Partial" } }] }) +
        chunk({ error: { code: "server_error", message: "Provider disconnected" }, choices: [{ delta: { content: "" }, finish_reason: "error" }] }),
    );
    const events = await collect(createChatStream(upstream, { startedAt: 0, isTimedOut: () => false, onComplete: (r) => void records.push(r) }));
    expect(events.at(-1)).toMatchObject({ type: "error", error: { code: "upstream_error" } });
    expect(records[0]).toMatchObject({ status: "error", text: "Partial" });
  });

  it("reports a timeout when the upstream read fails after our deadline", async () => {
    // First read delivers a chunk, the second fails (as an aborted fetch body does).
    // Erroring in start() would discard the queued chunk, per the Streams spec.
    let reads = 0;
    const upstream = new ReadableStream<Uint8Array>({
      pull(controller) {
        reads += 1;
        if (reads === 1) controller.enqueue(new TextEncoder().encode(chunk({ choices: [{ delta: { content: "Half" } }] })));
        else controller.error(new Error("aborted"));
      },
    });
    const events = await collect(createChatStream(upstream, { startedAt: 0, isTimedOut: () => true }));
    expect(events.map((e) => e.type)).toEqual(["delta", "error"]);
    expect(events.at(-1)).toMatchObject({ error: { code: "timeout" } });
  });

  it("ignores malformed JSON lines", async () => {
    const upstream = fakeUpstream("data: {not json\n\n" + chunk({ choices: [{ delta: { content: "ok" } }] }) + "data: [DONE]\n\n");
    const events = await collect(createChatStream(upstream, { startedAt: 0, isTimedOut: () => false }));
    expect(events.map((e) => e.type)).toEqual(["delta", "done"]);
  });
});

describe("projectMonthlyCost", () => {
  it("prefers the cost OpenRouter reported", () => {
    expect(projectMonthlyCost({ promptTokens: 1000, completionTokens: 500, cost: 0.002 }, { input: 1, output: 5 })).toEqual({
      perRequest: 0.002,
      monthly: 6, // 0.002 * 100/day * 30 days
    });
  });
  it("falls back to list prices, and returns null when unknown", () => {
    const p = projectMonthlyCost({ promptTokens: 1_000_000, completionTokens: 0, cost: null }, { input: 1, output: 5 });
    expect(p?.perRequest).toBe(1);
    expect(projectMonthlyCost({ promptTokens: 10, completionTokens: 10, cost: null }, { input: null, output: 1 })).toBeNull();
  });
});

describe("pickDefaultModel", () => {
  const [terra, flash] = getSampleModels();
  const free = { ...flash!, id: "x/free-a:free", pricing: { input: 0, output: 0, cacheRead: null, cacheWrite: null } };
  const freeBetter = { ...free, id: "x/free-b:free", benchmarks: { ...free.benchmarks, intelligence: { value: 60, source: "artificial-analysis" as const } } };

  it("uses the first preferred id that exists, in order", () => {
    expect(pickDefaultModel([terra!, free], [undefined, "missing/model", "openai/gpt-6.1-terra"])?.id).toBe("openai/gpt-6.1-terra");
  });
  it("otherwise picks the best-scoring free model", () => {
    expect(pickDefaultModel([terra!, free, freeBetter], ["missing/model"])?.id).toBe("x/free-b:free");
  });
  it("falls back to any model when none are free", () => {
    expect(pickDefaultModel([terra!])?.id).toBe("openai/gpt-6.1-terra");
    expect(pickDefaultModel([])).toBeUndefined();
  });
});

describe("orderModels", () => {
  it("puts configured provider models first (with defaultModel at the top) before catalog models", () => {
    const geminiModels = parseProviderModels("gemini", {
      data: [{ id: "models/gemini-2.0-flash" }, { id: "models/gemini-2.5-flash" }],
    });
    const catalogModels = [
      { ...geminiModels[0]!, id: "openai/gpt-4o", upstreamId: "openai/gpt-4o", provider: "openrouter" as const, name: "GPT-4o" },
    ];
    const ordered = orderModels(geminiModels, catalogModels, ["gemini"]);
    expect(ordered.map((m) => m.id)).toEqual(["gemini:gemini-2.5-flash", "gemini:gemini-2.0-flash", "openai/gpt-4o"]);
  });
});
