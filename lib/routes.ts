/** URL builders, so ids with slashes/colons are encoded the same way everywhere. */

/** "openai/gpt-6.1-terra" -> "/models/openai/gpt-6.1-terra" (each segment encoded, slashes kept). */
export function modelHref(id: string): string {
  return `/models/${id.split("/").map(encodeURIComponent).join("/")}`;
}

/** Reverse of modelHref for the catch-all route's params. Returns null for malformed encoding. */
export function idFromSegments(segments: string[]): string | null {
  try {
    return segments.map(decodeURIComponent).join("/");
  } catch {
    return null;
  }
}

export function playgroundHref(id: string): string {
  return `/playground?model=${encodeURIComponent(id)}`;
}
