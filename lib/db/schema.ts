import { doublePrecision, index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/*
 * One row per playground request that reached a model. Rows belong to an
 * anonymous session (the httpOnly cookie id); nothing identifies a person.
 *
 * Indexes match the two access patterns:
 *  - (session_id, created_at): "my history, newest first", paginated
 *  - (model): filtering and grouping by model
 */
export const requestStatus = pgEnum("request_status", ["success", "error", "aborted"]);

export const requests = pgTable(
  "requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").notNull(),
    model: text("model").notNull(),
    /** The last user message (what was asked). */
    prompt: text("prompt").notNull(),
    /** The reply text; partial for stopped or failed streams. */
    response: text("response").notNull().default(""),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    totalTokens: integer("total_tokens"),
    /** USD reported by OpenRouter for this request, when available. */
    costUsd: doublePrecision("cost_usd"),
    latencyMs: integer("latency_ms").notNull(),
    status: requestStatus("status").notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("requests_session_created_idx").on(table.sessionId, table.createdAt),
    index("requests_model_idx").on(table.model),
  ],
);

export type RequestRow = typeof requests.$inferSelect;
export type NewRequestRow = typeof requests.$inferInsert;
export type RequestStatus = (typeof requestStatus.enumValues)[number];
