"use client";

/**
 * Formats a timestamp in the visitor's own timezone. The server can't know it,
 * so the server-rendered text (server timezone) is replaced on hydration;
 * suppressHydrationWarning acknowledges that intentional difference.
 */
const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export function LocalTime({ iso, className }: { iso: string; className?: string }) {
  return (
    <time dateTime={iso} title={iso} suppressHydrationWarning className={className}>
      {formatter.format(new Date(iso))}
    </time>
  );
}
