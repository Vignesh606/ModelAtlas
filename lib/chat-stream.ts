import { z } from "zod";
import { encodeEvent, type ChatEvent, type ChatUsage } from "@/lib/chat";
import { createSseParser } from "@/lib/sse";

/*
 * Transforms an OpenAI-compatible SSE stream (OpenRouter or any provider) into our normalized ChatEvent stream.
 * Kept free of Next.js imports so it can be unit-tested with a fake stream.
 */

const chunkSchema = z.object({
  error: z.object({ message: z.string().optional() }).nullish(),
  choices: z
    .array(
      z.object({
        delta: z
          // `reasoning` is OpenRouter's name; DeepSeek and xAI use `reasoning_content`.
          .object({ content: z.string().nullish(), reasoning: z.string().nullish(), reasoning_content: z.string().nullish() })
          .nullish(),
        finish_reason: z.string().nullish(),
      }),
    )
    .nullish(),
  usage: z
    .object({
      // Lenient: some providers send partial usage objects mid-stream.
      prompt_tokens: z.number().nullish(),
      completion_tokens: z.number().nullish(),
      total_tokens: z.number().nullish(),
      cost: z.number().nullish(),
    })
    .nullish(),
});

/** What happened, reported once when the stream ends (used for history in Phase 5). */
export interface CompletionRecord {
  status: "success" | "error" | "aborted";
  text: string;
  usage: ChatUsage | null;
  latencyMs: number;
  finishReason: string | null;
  errorMessage: string | null;
}

interface Options {
  startedAt: number;
  /** True when the abort came from our timeout rather than the client leaving. */
  isTimedOut: () => boolean;
  onComplete?: (record: CompletionRecord) => void | Promise<void>;
  now?: () => number;
}

export function createChatStream(upstream: ReadableStream<Uint8Array>, options: Options): ReadableStream<Uint8Array> {
  const now = options.now ?? Date.now;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.getReader();

  let text = "";
  let usage: ChatUsage | null = null;
  let finishReason: string | null = null;
  let upstreamError: string | null = null;
  let finished = false;

  const finish = async (record: Omit<CompletionRecord, "text" | "usage" | "latencyMs" | "finishReason">) => {
    if (finished) return;
    finished = true;
    try {
      await options.onComplete?.({ ...record, text, usage, latencyMs: now() - options.startedAt, finishReason });
    } catch (error) {
      console.error("[chat] onComplete failed:", error);
    }
  };

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: ChatEvent) => controller.enqueue(encoder.encode(encodeEvent(event)));

      const parser = createSseParser((data) => {
        if (data === "[DONE]" || upstreamError) return;
        let json: unknown;
        try {
          json = JSON.parse(data);
        } catch {
          return; // ignore malformed lines rather than failing the whole response
        }
        const parsed = chunkSchema.safeParse(json);
        if (!parsed.success) return;
        const chunk = parsed.data;

        // Mid-stream errors arrive as a chunk with a top-level `error` (finish_reason "error").
        if (chunk.error) {
          upstreamError = chunk.error.message ?? "The provider reported an error.";
          return;
        }
        const choice = chunk.choices?.[0];
        const reasoning = choice?.delta?.reasoning ?? choice?.delta?.reasoning_content;
        if (reasoning) emit({ type: "reasoning", text: reasoning });
        if (choice?.delta?.content) {
          text += choice.delta.content;
          emit({ type: "delta", text: choice.delta.content });
        }
        if (choice?.finish_reason) finishReason = choice.finish_reason;
        if (chunk.usage?.prompt_tokens != null && chunk.usage.completion_tokens != null) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens ?? chunk.usage.prompt_tokens + chunk.usage.completion_tokens,
            cost: chunk.usage.cost ?? null,
          };
        }
      });

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          parser.push(decoder.decode(value, { stream: true }));
        }
        parser.flush();

        if (upstreamError) {
          emit({ type: "error", error: { code: "upstream_error", message: `The provider failed mid-response: ${upstreamError}` } });
          await finish({ status: "error", errorMessage: upstreamError });
        } else {
          emit({ type: "done", usage, latencyMs: now() - options.startedAt, finishReason });
          await finish({ status: "success", errorMessage: null });
        }
        controller.close();
      } catch (error) {
        if (options.isTimedOut()) {
          emit({ type: "error", error: { code: "timeout", message: "The model took too long to respond. Partial output is shown." } });
          await finish({ status: "error", errorMessage: "timeout" });
          controller.close();
        } else {
          // The client went away (Stop button, closed tab): nobody to send to.
          await finish({ status: "aborted", errorMessage: error instanceof Error ? error.message : "aborted" });
          try {
            controller.close();
          } catch {
            // already closed/cancelled
          }
        }
      }
    },
    async cancel() {
      // Client disconnected: stop reading upstream so the provider stops generating (and billing).
      await reader.cancel().catch(() => {});
      await finish({ status: "aborted", errorMessage: "client disconnected" });
    },
  });
}
