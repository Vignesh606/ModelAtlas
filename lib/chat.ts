import { z } from "zod";
import { API_ERROR_CODES, type ApiErrorBody } from "@/lib/api-error";
import { PROVIDER_IDS } from "@/lib/providers";

/*
 * The contract between the playground and POST /api/chat, shared by both sides.
 *
 * Request: JSON validated by `chatRequestSchema`. A user's own provider key
 * travels in the `x-provider-key` header (kept out of the body so it is never
 * part of anything we might log or store).
 *
 * Response: Server-Sent Events, one JSON `ChatEvent` per `data:` line. We
 * normalize the provider's chunks into these few events so the client never
 * depends on the upstream format.
 */

export const CHAT_LIMITS = {
  maxMessages: 40,
  maxMessageChars: 16_000,
  maxTotalChars: 64_000,
  maxSystemChars: 4_000,
  maxOutputTokens: 8_192,
} as const;

export const USER_KEY_HEADER = "x-provider-key";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(CHAT_LIMITS.maxMessageChars, `Each message must be under ${CHAT_LIMITS.maxMessageChars} characters.`),
});

export const chatRequestSchema = z
  .object({
    /** Which API to call: Google Gemini by default, or any other configured provider. */
    provider: z.enum(PROVIDER_IDS).default("gemini"),
    /** The provider's own model id, e.g. "openai/gpt-4o" on OpenRouter or "gpt-4o" on OpenAI. */
    model: z.string().trim().min(2, "Choose a model.").max(200).regex(/^[\w.:/@-]+$/, "Invalid model id."),
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
/** What the client sends (provider may be omitted). */
export type ChatRequestInput = z.input<typeof chatRequestSchema>;
export type ChatMessage = z.infer<typeof messageSchema>;

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
  /** USD charged for this request, when the provider reports it (OpenRouter does). */
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
