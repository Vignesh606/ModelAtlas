import "server-only";
import { cookies } from "next/headers";

/*
 * Anonymous session: a random UUID in an httpOnly cookie. It is "strictly
 * necessary" (it scopes rate limits and, later, your request history to this
 * browser), so it needs no consent. httpOnly keeps it away from client JS.
 */
export const SESSION_COOKIE = "ma_session";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads the session id without creating one (for read-only routes). */
export async function readSessionId(): Promise<string | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return value && UUID_PATTERN.test(value) ? value : null;
}

/**
 * Returns the session id, creating the cookie if needed. Only call from a
 * Route Handler or Server Function, before streaming starts (HTTP headers,
 * including Set-Cookie, can't change once the body has begun).
 */
export async function getOrCreateSessionId(): Promise<string> {
  const existing = await readSessionId();
  if (existing) return existing;

  const id = crypto.randomUUID();
  (await cookies()).set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
  return id;
}
