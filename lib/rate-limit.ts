/**
 * Sliding-window rate limiter kept in memory.
 *
 * Limitation (documented in the README): on serverless platforms each instance
 * has its own memory, so this is a best-effort per-instance limit. It protects
 * against accidental loops and casual abuse; a shared store (Redis, or the
 * database) would be needed for a strict global limit.
 */
const hits = new Map<string, number[]>();
const MAX_KEYS = 10_000;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Seconds until the next request is allowed (0 when ok). */
  retryAfterSec: number;
}

export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= limit) {
    hits.set(key, recent);
    const oldest = recent[0] ?? now;
    return { ok: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
  }

  recent.push(now);
  hits.delete(key); // re-insert so Map order tracks recency
  hits.set(key, recent);

  // Bound memory: evict the least recently used keys.
  while (hits.size > MAX_KEYS) {
    const oldestKey = hits.keys().next().value;
    if (oldestKey === undefined) break;
    hits.delete(oldestKey);
  }

  return { ok: true, remaining: limit - recent.length, retryAfterSec: 0 };
}

/** Test helper. */
export function resetRateLimits() {
  hits.clear();
}
