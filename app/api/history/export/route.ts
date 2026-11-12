import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { exportHistory, isHistoryEnabled } from "@/lib/history";
import { parseHistoryQuery, toCsv } from "@/lib/history-query";
import { readSessionId } from "@/lib/session";

/**
 * GET /api/history/export?format=csv|json&model=&q= -> file download of this
 * session's history (same filters as the list, newest first, capped at 5,000 rows).
 */
const COLUMNS = [
  "id",
  "createdAt",
  "model",
  "status",
  "prompt",
  "response",
  "promptTokens",
  "completionTokens",
  "totalTokens",
  "costUsd",
  "latencyMs",
  "errorMessage",
] as const;

export async function GET(request: NextRequest) {
  if (!isHistoryEnabled()) return apiError("internal_error", "History is not configured on this server.", 503);

  const format = request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "json";
  const query = parseHistoryQuery(request.nextUrl.searchParams);
  const sessionId = await readSessionId();

  try {
    const rows = sessionId ? await exportHistory(sessionId, query) : [];
    // The session id is an internal ownership key: leave it out of exports.
    const records = rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      model: r.model,
      status: r.status,
      prompt: r.prompt,
      response: r.response,
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      totalTokens: r.totalTokens,
      costUsd: r.costUsd,
      latencyMs: r.latencyMs,
      errorMessage: r.errorMessage,
    }));

    const stamp = new Date().toISOString().slice(0, 10);
    const headers = {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="modelatlas-history-${stamp}.${format}"`,
    };
    if (format === "csv") {
      // A UTF-8 BOM makes Excel read non-ASCII characters correctly.
      return new Response(`﻿${toCsv(records, [...COLUMNS])}`, {
        headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
      });
    }
    return new Response(JSON.stringify(records, null, 2), {
      headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    console.error("[history] export failed:", error instanceof Error ? error.message : error);
    return apiError("internal_error", "Couldn't export history. Try again.", 500);
  }
}
