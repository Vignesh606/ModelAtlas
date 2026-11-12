import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { isHistoryEnabled, listHistory } from "@/lib/history";
import { parseHistoryQuery } from "@/lib/history-query";
import { readSessionId } from "@/lib/session";

/**
 * GET /api/history?page=1&model=a/b&q=text -> paginated list for this browser's session.
 * No session cookie yet simply means an empty history (not an error).
 */
export async function GET(request: NextRequest) {
  if (!isHistoryEnabled()) return apiError("internal_error", "History is not configured on this server.", 503);

  const query = parseHistoryQuery(request.nextUrl.searchParams);
  const sessionId = await readSessionId();
  if (!sessionId) return Response.json({ items: [], total: 0, page: 1, pageSize: 20, pageCount: 1 });

  try {
    return Response.json(await listHistory(sessionId, query), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[history] list failed:", error instanceof Error ? error.message : error);
    return apiError("internal_error", "Couldn't load history. Try again.", 500);
  }
}
