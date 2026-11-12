import "server-only";
import { and, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { ChatUsage } from "@/lib/chat";
import { getDb } from "@/lib/db";
import { requests, type RequestRow, type RequestStatus } from "@/lib/db/schema";
import { EXPORT_LIMIT, HISTORY_PAGE_SIZE, escapeLike, type HistoryQuery } from "@/lib/history-query";

/*
 * All history reads and writes. Every query is scoped to the caller's session
 * id, so one browser can never see another browser's requests.
 * Used directly by Server Components (no HTTP hop) and by the /api/history routes.
 */

const MAX_STORED_CHARS = 100_000; // cap very long replies so one row can't bloat the table
const PREVIEW_CHARS = 160;

export function isHistoryEnabled(): boolean {
  return getDb() !== null;
}

export interface SaveRequestInput {
  sessionId: string;
  model: string;
  prompt: string;
  response: string;
  usage: ChatUsage | null;
  latencyMs: number;
  status: RequestStatus;
  errorMessage: string | null;
}

/** Never throws: a failed history write must not break the chat that triggered it. */
export async function saveRequest(input: SaveRequestInput): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.insert(requests).values({
      sessionId: input.sessionId,
      model: input.model,
      prompt: input.prompt.slice(0, MAX_STORED_CHARS),
      response: input.response.slice(0, MAX_STORED_CHARS),
      promptTokens: input.usage?.promptTokens ?? null,
      completionTokens: input.usage?.completionTokens ?? null,
      totalTokens: input.usage?.totalTokens ?? null,
      costUsd: input.usage?.cost ?? null,
      latencyMs: Math.max(0, Math.round(input.latencyMs)),
      status: input.status,
      errorMessage: input.errorMessage?.slice(0, 1_000) ?? null,
    });
  } catch (error) {
    console.error("[history] failed to save request:", error instanceof Error ? error.message : error);
  }
}

function filters(sessionId: string, query: Pick<HistoryQuery, "model" | "q">): SQL | undefined {
  const conditions: Array<SQL | undefined> = [eq(requests.sessionId, sessionId)];
  if (query.model) conditions.push(eq(requests.model, query.model));
  if (query.q) {
    // Backslash is Postgres's default LIKE escape character, matching escapeLike().
    const pattern = `%${escapeLike(query.q)}%`;
    conditions.push(or(ilike(requests.prompt, pattern), ilike(requests.response, pattern)));
  }
  return and(...conditions);
}

export interface HistoryListItem {
  id: string;
  model: string;
  promptPreview: string;
  status: RequestStatus;
  totalTokens: number | null;
  latencyMs: number;
  createdAt: string;
}

export interface HistoryPage {
  items: HistoryListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export async function listHistory(sessionId: string, query: HistoryQuery): Promise<HistoryPage> {
  const db = getDb();
  const empty = { items: [], total: 0, page: 1, pageSize: HISTORY_PAGE_SIZE, pageCount: 1 };
  if (!db) return empty;

  const where = filters(sessionId, query);
  const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(requests).where(where);
  const pageCount = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
  const page = Math.min(query.page, pageCount);

  const rows = await db
    .select({
      id: requests.id,
      model: requests.model,
      // Only the first characters travel to the list view.
      promptPreview: sql<string>`left(${requests.prompt}, ${PREVIEW_CHARS})`,
      status: requests.status,
      totalTokens: requests.totalTokens,
      latencyMs: requests.latencyMs,
      createdAt: requests.createdAt,
    })
    .from(requests)
    .where(where)
    .orderBy(desc(requests.createdAt))
    .limit(HISTORY_PAGE_SIZE)
    .offset((page - 1) * HISTORY_PAGE_SIZE);

  return {
    items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    total,
    page,
    pageSize: HISTORY_PAGE_SIZE,
    pageCount,
  };
}

export async function getHistoryItem(sessionId: string, id: string): Promise<RequestRow | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(requests)
    .where(and(eq(requests.id, id), eq(requests.sessionId, sessionId)))
    .limit(1);
  return row ?? null;
}

export interface HistoryStats {
  total: number;
  successRate: number | null;
  totalTokens: number;
  avgLatencyMs: number | null;
  byModel: Array<{ model: string; count: number }>;
}

/** Aggregates for the analytics strip, computed in SQL (one round trip each). */
export async function getHistoryStats(sessionId: string): Promise<HistoryStats> {
  const db = getDb();
  if (!db) return { total: 0, successRate: null, totalTokens: 0, avgLatencyMs: null, byModel: [] };
  const mine = eq(requests.sessionId, sessionId);

  const [[totals], byModel] = await Promise.all([
    db
      .select({
        total: count(),
        success: sql<number>`count(*) filter (where ${requests.status} = 'success')`.mapWith(Number),
        tokens: sql<number>`coalesce(sum(${requests.totalTokens}), 0)`.mapWith(Number),
        // Latency of successful requests only: failures return fast and would skew it.
        avgLatency: sql<number | null>`avg(${requests.latencyMs}) filter (where ${requests.status} = 'success')`.mapWith(
          (v: string | null) => (v === null ? null : Number(v)),
        ),
      })
      .from(requests)
      .where(mine),
    db
      .select({ model: requests.model, count: count() })
      .from(requests)
      .where(mine)
      .groupBy(requests.model)
      .orderBy(desc(count()))
      .limit(100),
  ]);

  const total = totals?.total ?? 0;
  return {
    total,
    successRate: total ? (totals?.success ?? 0) / total : null,
    totalTokens: totals?.tokens ?? 0,
    avgLatencyMs: totals?.avgLatency ?? null,
    byModel,
  };
}

/** Full rows for export (newest first), capped so a request can't stream unbounded data. */
export async function exportHistory(sessionId: string, query: Pick<HistoryQuery, "model" | "q">): Promise<RequestRow[]> {
  const db = getDb();
  if (!db) return [];
  return db.select().from(requests).where(filters(sessionId, query)).orderBy(desc(requests.createdAt)).limit(EXPORT_LIMIT);
}
