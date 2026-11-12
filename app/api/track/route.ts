import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { firstIssue } from "@/lib/chat";
import { isHistoryEnabled } from "@/lib/history";
import { checkRateLimit } from "@/lib/rate-limit";
import { getOrCreateSessionId, readSessionId } from "@/lib/session";
import { CONSENT_COOKIE, decodeFirstTouch, trackRequestSchema, UTM_COOKIE } from "@/lib/utm";
import { deleteVisits, saveVisit } from "@/lib/visits";

/**
 * POST /api/track: records one page view. Consent is checked HERE as well as
 * in the browser: without the analytics consent cookie nothing is stored, so
 * a buggy or stale client can't track someone who declined.
 *
 * DELETE /api/track: removes this session's page views (called when the
 * visitor switches back to "Essential only").
 */
export async function POST(request: NextRequest) {
  if (request.cookies.get(CONSENT_COOKIE)?.value !== "analytics") {
    return apiError("invalid_request", "Analytics consent has not been given.", 403);
  }
  if (!isHistoryEnabled()) return new Response(null, { status: 204 }); // no database: accept and drop

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_request", "The request body must be valid JSON.", 400);
  }
  const parsed = trackRequestSchema.safeParse(body);
  if (!parsed.success) return apiError("invalid_request", firstIssue(parsed.error), 400);

  const sessionId = await getOrCreateSessionId();
  const limit = checkRateLimit(`track:${sessionId}`, 60, 60_000);
  if (!limit.ok) return new Response(null, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });

  // Prefer the first-touch cookie (set at landing) over the body, so attribution
  // stays first-touch even if a later page sends something different.
  const touch = decodeFirstTouch(request.cookies.get(UTM_COOKIE)?.value) ?? parsed.data.firstTouch;

  try {
    await saveVisit(sessionId, parsed.data.path, touch);
  } catch (error) {
    console.error("[track] failed to save visit:", error instanceof Error ? error.message : error);
  }
  return new Response(null, { status: 204 });
}

export async function DELETE() {
  const sessionId = await readSessionId();
  if (sessionId && isHistoryEnabled()) {
    try {
      await deleteVisits(sessionId);
    } catch (error) {
      console.error("[track] failed to delete visits:", error instanceof Error ? error.message : error);
      return apiError("internal_error", "Couldn't delete analytics data. Try again.", 500);
    }
  }
  return new Response(null, { status: 204 });
}
