/*
 * /compare?models=a/b,c/d is the source of truth for the comparison.
 * Parsing is defensive: anything malformed, unknown, duplicated or beyond the
 * 4-model limit is dropped silently, so a hand-edited URL never crashes.
 */

export const MAX_COMPARE = 4;
export const MIN_COMPARE = 2;

/** Loose shape check for "lab/model" ids (OpenRouter ids may contain ".", ":", "-", "_"). */
const ID_PATTERN = /^[a-z0-9][\w.\-]*\/[\w.\-:]+$/i;

export function parseCompareIds(
  raw: string | string[] | null | undefined,
  knownIds?: ReadonlySet<string>,
): string[] {
  const value = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  const ids: string[] = [];
  for (const part of value.split(",")) {
    const id = part.trim();
    if (!id || id.length > 200 || !ID_PATTERN.test(id)) continue;
    if (knownIds && !knownIds.has(id)) continue;
    if (ids.includes(id)) continue;
    ids.push(id);
    if (ids.length === MAX_COMPARE) break;
  }
  return ids;
}

/** Number of non-empty entries in the raw param, to tell the user how many were skipped. */
export function countRawIds(raw: string | string[] | null | undefined): number {
  const value = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  return value.split(",").filter((part) => part.trim() !== "").length;
}

/**
 * Commas separate ids, so they are the only thing that must not appear raw.
 * Slashes and colons are left readable, matching the brief's example URL.
 */
export function serializeCompareIds(ids: readonly string[]): string {
  return ids.map((id) => encodeURIComponent(id).replace(/%2F/gi, "/").replace(/%3A/gi, ":")).join(",");
}

export function compareHref(ids: readonly string[]): string {
  return ids.length ? `/compare?models=${serializeCompareIds(ids)}` : "/compare";
}
