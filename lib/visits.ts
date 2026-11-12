import "server-only";
import { count, countDistinct, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requests, visits } from "@/lib/db/schema";
import type { FirstTouch } from "@/lib/utm";

/** Consented page views and the user's "delete my data" action. */

export async function saveVisit(sessionId: string, path: string, touch: FirstTouch | null): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db.insert(visits).values({
    sessionId,
    path,
    utmSource: touch?.source ?? null,
    utmMedium: touch?.medium ?? null,
    utmCampaign: touch?.campaign ?? null,
    utmTerm: touch?.term ?? null,
    utmContent: touch?.content ?? null,
    referrer: touch?.referrer ?? null,
  });
}

export async function deleteVisits(sessionId: string): Promise<void> {
  await getDb()?.delete(visits).where(eq(visits.sessionId, sessionId));
}

/** Removes everything stored for this session: playground history and page views. */
export async function deleteSessionData(sessionId: string): Promise<{ requests: number; visits: number }> {
  const db = getDb();
  if (!db) return { requests: 0, visits: 0 };
  const [deletedRequests, deletedVisits] = await Promise.all([
    db.delete(requests).where(eq(requests.sessionId, sessionId)).returning({ id: requests.id }),
    db.delete(visits).where(eq(visits.sessionId, sessionId)).returning({ id: visits.id }),
  ]);
  return { requests: deletedRequests.length, visits: deletedVisits.length };
}

export interface CampaignCount {
  campaign: string;
  visitors: number;
  views: number;
}

/**
 * Aggregate counts per first-touch campaign across all consenting visitors.
 * Only totals are exposed, never individual sessions.
 */
export async function getCampaignCounts(limit = 8): Promise<CampaignCount[]> {
  const db = getDb();
  if (!db) return [];
  const campaign = sql<string>`coalesce(${visits.utmCampaign}, '(direct / none)')`;
  const rows = await db
    .select({ campaign, visitors: countDistinct(visits.sessionId), views: count() })
    .from(visits)
    .groupBy(campaign)
    .orderBy(desc(count()))
    .limit(limit);
  return rows;
}
