import { z } from "zod";
import { API_ERROR_CODES, type ApiErrorBody } from "@/lib/api-error";

/*
 * The contract between the playground and POST /api/chat, shared by both sides.
 *
 * Request: JSON validated by `chatRequestSchema`. A user's own OpenRouter key
 * travels in the `x-openrouter-key` header (kept out of the body so it is never
 * part of anything we might log or store).
 *
 * Response: Server-Sent Events, one JSON `ChatEvent` per `data:` line. We
 * normalize OpenRouter's chunks into these few events so the client never
 * depends on the upstream format.
 */

export const CHAT_LIMITS = {
  maxMessages: 40,
  maxMessageChars: 16_000,
  maxTotalChars: 64_000,
  maxSystemChars: 4_000,
  maxOutputTokens: 8_192,
} as const;

export const USER_KEY_HEADER = "x-openrouter-key";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(CHAT_LIMITS.maxMessageChars, `Each message must be under ${CHAT_LIMITS.maxMessageChars} characters.`),
});

export const chatRequestSchema = z
  .object({
    model: z.string().trim().min(3, "Choose a model.").max(200),
    messages: z
      .array(messageSchema)
      .min(1, "Send at least one message.")
      .max(CHAT_LIMITS.maxMessages, `Conversations are limited to ${CHAT_LIMITS.maxMessages} messages. Clear the chat to continue.`)
      .refine((messages) => {
        const last = messages.at(-1);
        return last?.role === "user" && last.content.trim().length > 0;
      }, "The last message must be a non-empty user message.")
      .refine(
        (messages) => messages.reduce((sum, m) => sum + m.content.length, 0) <= CHAT_LIMITS.maxTotalChars,
        `The conversation is too long (over ${CHAT_LIMITS.maxTotalChars} characters). Clear the chat to continue.`,
      ),
    system: z.string().max(CHAT_LIMITS.maxSystemChars, `The system prompt must be under ${CHAT_LIMITS.maxSystemChars} characters.`).optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(1).max(CHAT_LIMITS.maxOutputTokens).optional(),
  })
  .strict();

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatMessage = z.infer<typeof messageSchema>;

/** Shape check for a user-supplied OpenRouter key. */
export const userKeySchema = z.string().regex(/^sk-or-[A-Za-z0-9_-]{10,200}$/);

/*
 * Response-side schemas. The browser validates every event it receives, so a
 * malformed or unexpected payload is ignored instead of crashing the UI, and
 * no untyped `JSON.parse` result leaks into components.
 */
export const apiErrorBodySchema = z.object({
  error: z.object({ code: z.enum(API_ERROR_CODES), message: z.string() }),
});

const usageSchema = z.object({
  promptTokens: z.number(),
  completionTokens: z.number(),
  totalTokens: z.number(),
  /** USD charged by OpenRouter for this request, when reported. */
  cost: z.number().nullable(),
});

export const chatEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("delta"), text: z.string() }),
  z.object({ type: z.literal("reasoning"), text: z.string() }),
  z.object({
    type: z.literal("done"),
    usage: usageSchema.nullable(),
    latencyMs: z.number(),
    finishReason: z.string().nullable(),
  }),
  z.object({ type: z.literal("error") }).extend(apiErrorBodySchema.shape),
]);

export type ChatUsage = z.infer<typeof usageSchema>;
export type ChatEvent = z.infer<typeof chatEventSchema>;
export type ChatError = ApiErrorBody["error"];

export function encodeEvent(event: ChatEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** First validation message, phrased for the user. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid request.";
}
