import { z } from "zod";

/*
 * Pure helpers for history: query parsing, search escaping and CSV export.
 * No database imports, so they are unit-tested without Postgres.
 */

export const HISTORY_PAGE_SIZE = 20;
export const EXPORT_LIMIT = 5_000;

/** First value of a search param (Next passes string | string[] | undefined). */
const firstValue = (value: unknown) => (Array.isArray(value) ? value[0] : value);

/**
 * Lenient: bad values fall back to defaults instead of failing, because
 * these come from user-editable URLs.
 */
export const historyQuerySchema = z.object({
  page: z.preprocess(firstValue, z.coerce.number().int().min(1).max(10_000).catch(1)).default(1),
  model: z.preprocess(firstValue, z.string().trim().min(3).max(200).optional().catch(undefined)),
  q: z.preprocess(firstValue, z.string().trim().max(200).optional().catch(undefined)),
});

export type HistoryQuery = z.infer<typeof historyQuerySchema>;

export function parseHistoryQuery(params: Record<string, string | string[] | undefined> | URLSearchParams): HistoryQuery {
  const record = params instanceof URLSearchParams ? Object.fromEntries(params) : params;
  const parsed = historyQuerySchema.parse(record);
  return { ...parsed, q: parsed.q || undefined };
}

export function serializeHistoryQuery(query: Partial<HistoryQuery>): string {
  const params = new URLSearchParams();
  if (query.model) params.set("model", query.model);
  if (query.q) params.set("q", query.q);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  return params.toString();
}

/** Escapes LIKE wildcards so a search for "50%" matches the literal text. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/**
 * One CSV cell (RFC 4180): quote when needed, double inner quotes. Cells that
 * start with = + - @ (or tab/CR) get a leading apostrophe so spreadsheet apps
 * don't execute them as formulas (CSV injection), since prompts are user text.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T extends Record<string, string | number | null>>(rows: T[], columns: Array<keyof T & string>): string {
  const header = columns.join(",");
  const lines = rows.map((row) => columns.map((column) => csvCell(row[column])).join(","));
  return [header, ...lines].join("\r\n");
}
