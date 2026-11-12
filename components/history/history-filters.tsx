"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { serializeHistoryQuery, type HistoryQuery } from "@/lib/history-query";

/*
 * History data lives in the database, so filtering must re-render on the
 * server: we update the URL with router.replace (a soft navigation, no full
 * reload). useTransition keeps the current table visible while the new one loads.
 */
export function HistoryFilters({
  query,
  models,
}: {
  query: HistoryQuery;
  models: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [text, setText] = useState(query.q ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const navigate = (next: Partial<HistoryQuery>) => {
    const qs = serializeHistoryQuery({ model: query.model, q: query.q, ...next, page: 1 });
    startTransition(() => router.replace(qs ? `/history?${qs}` : "/history", { scroll: false }));
  };

  // Debounced in the handler itself: navigate 300ms after the last keystroke.
  const onSearchChange = (value: string) => {
    setText(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => navigate({ q: value.trim() || undefined }), 300);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <label className="relative flex-1">
        <span className="sr-only">Search prompts and responses</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          value={text}
          onChange={(e) => onSearchChange(e.target.value)}
          maxLength={200}
          placeholder="Search prompts and responses..."
          className="h-10 w-full rounded-lg border border-border bg-bg pr-3 pl-9 text-sm placeholder:text-muted hover:border-border-strong"
        />
      </label>
      <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-bg px-3 text-sm hover:border-border-strong sm:w-72 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
        <span className="text-muted">Model</span>
        <select
          value={query.model ?? ""}
          onChange={(e) => navigate({ model: e.target.value || undefined })}
          className="min-w-0 flex-1 truncate bg-transparent font-medium focus-visible:outline-none"
        >
          <option value="">All models ({models.length})</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <span aria-live="polite" className="flex h-10 w-6 items-center justify-center text-muted">
        {isPending ? <Spinner label="Updating results" /> : null}
      </span>
    </div>
  );
}
