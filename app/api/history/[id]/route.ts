import { apiError } from "@/lib/api-error";
import { getHistoryItem, isHistoryEnabled } from "@/lib/history";
import { isUuid } from "@/lib/history-query";
import { readSessionId } from "@/lib/session";

/**
 * GET /api/history/:id -> one request, only if it belongs to this session.
 * Another session's id returns 404 (not 403), so ids can't be probed for existence.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/history/[id]">) {
  if (!isHistoryEnabled()) return apiError("internal_error", "History is not configured on this server.", 503);

  const { id } = await params;
  const sessionId = await readSessionId();
  if (!sessionId || !isUuid(id)) return apiError("not_found", "Request not found.", 404);

  try {
    const row = await getHistoryItem(sessionId, id);
    if (!row) return apiError("not_found", "Request not found.", 404);
    // Never echo the session id: it is the httpOnly cookie's value, and returning
    // it would expose that secret to client-side JavaScript.
    const { sessionId: _omit, ...publicRow } = row;
    return Response.json(publicRow, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[history] get failed:", error instanceof Error ? error.message : error);
    return apiError("internal_error", "Couldn't load this request. Try again.", 500);
  }
}
