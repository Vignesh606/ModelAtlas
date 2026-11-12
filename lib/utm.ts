import { z } from "zod";

/*
 * Campaign attribution, shared by the browser (capture) and /api/track (validation).
 * Nothing here runs or is stored until the visitor accepts analytics.
 */

export const CONSENT_COOKIE = "ma_consent"; // "essential" | "analytics" (remembers the choice)
export const UTM_COOKIE = "ma_utm"; // first-touch attribution, 30 days
export const UTM_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type ConsentChoice = "essential" | "analytics";

const UTM_PARAMS = {
  source: "utm_source",
  medium: "utm_medium",
  campaign: "utm_campaign",
  term: "utm_term",
  content: "utm_content",
} as const;

const field = z.string().trim().min(1).max(100);

export const firstTouchSchema = z
  .object({
    source: field.optional(),
    medium: field.optional(),
    campaign: field.optional(),
    term: field.optional(),
    content: field.optional(),
    referrer: z.string().url().max(300).optional(),
    landedAt: z.string().datetime(),
  })
  .strict();

export type FirstTouch = z.infer<typeof firstTouchSchema>;

export const trackRequestSchema = z
  .object({
    path: z.string().startsWith("/").max(300),
    firstTouch: firstTouchSchema.nullable(),
  })
  .strict();

/** Strips control characters and caps length; UTM values are attacker-controlled URL text. */
function clean(value: string | null): string | undefined {
  const text = value?.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 100);
  return text ? text : undefined;
}

/**
 * External referrer reduced to origin + path: query strings can carry tokens
 * or personal data, and our own pages aren't a "referrer".
 */
export function externalReferrer(referrer: string, ownOrigin: string): string | undefined {
  try {
    const url = new URL(referrer);
    if (url.origin === ownOrigin || !/^https?:$/.test(url.protocol)) return undefined;
    return `${url.origin}${url.pathname}`.slice(0, 300);
  } catch {
    return undefined;
  }
}

/** First-touch data from a landing URL, or null if the visit has no campaign or external referrer. */
export function parseFirstTouch(search: string, referrer: string, ownOrigin: string, now: Date): FirstTouch | null {
  const params = new URLSearchParams(search);
  const touch: FirstTouch = { landedAt: now.toISOString() };
  for (const [key, param] of Object.entries(UTM_PARAMS) as Array<[keyof typeof UTM_PARAMS, string]>) {
    const value = clean(params.get(param));
    if (value) touch[key] = value;
  }
  const ref = externalReferrer(referrer, ownOrigin);
  if (ref) touch.referrer = ref;
  return Object.keys(touch).length > 1 ? touch : null;
}

export function encodeFirstTouch(touch: FirstTouch): string {
  return encodeURIComponent(JSON.stringify(touch));
}

/** Tolerates missing or tampered cookies by returning null. */
export function decodeFirstTouch(value: string | undefined | null): FirstTouch | null {
  if (!value) return null;
  try {
    const parsed = firstTouchSchema.safeParse(JSON.parse(decodeURIComponent(value)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Reads one cookie from a `document.cookie`-style string. */
export function readCookie(cookieHeader: string, name: string): string | undefined {
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}
