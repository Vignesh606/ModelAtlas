/** Display formatting. Pure functions, shared by server and client. "-" means "no data". */

export const NO_DATA = "-";

/** $ per 1M tokens: 0 -> "Free", small values keep enough precision ("$0.008"). */
export function formatPrice(perMillion: number | null): string {
  if (perMillion === null) return NO_DATA;
  if (perMillion === 0) return "Free";
  if (perMillion < 0.01) return `$${Number(perMillion.toPrecision(2))}`;
  return `$${perMillion.toFixed(2)}`;
}

/** Context window: 1_050_000 -> "1.05M", 131_072 -> "131K", 512 -> "512". */
export function formatContext(tokens: number | null): string {
  if (tokens === null || tokens <= 0) return NO_DATA;
  if (tokens >= 1_000_000) return `${Number((tokens / 1_000_000).toFixed(2))}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`;
  return String(tokens);
}

/** Large token counts in full with separators: 5000000 -> "5,000,000". */
export function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

// timeZone UTC: dates are stored as UTC calendar dates, so the server and
// browser must not shift them by a day depending on locale.
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-10-27" or a full ISO timestamp -> "Oct 27, 2026". */
export function formatDate(iso: string | null): string {
  if (!iso) return NO_DATA;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? NO_DATA : dateFormatter.format(date);
}

export function formatScore(value: number | undefined | null): string {
  return typeof value === "number" ? value.toFixed(1) : NO_DATA;
}
