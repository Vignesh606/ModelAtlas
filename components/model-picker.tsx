"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import type { ModelSummary } from "@/lib/types";

const MAX_RESULTS = 50;

/**
 * Searchable model combobox (WAI-ARIA combobox pattern). Focus stays in the
 * input; arrow keys move a virtual "active" option exposed through
 * aria-activedescendant, Enter selects, Escape closes. Options use
 * onMouseDown + preventDefault so clicking doesn't blur the input first.
 * Used by /compare and the playground.
 */
export function ModelPicker<T extends ModelSummary>({
  models,
  excludeIds = [],
  onSelect,
  label,
  placeholder = "Search by model, lab or id...",
  disabled = false,
  disabledHint,
}: {
  models: T[];
  excludeIds?: readonly string[];
  onSelect: (model: T) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (index: number) => `${baseId}-opt-${index}`;

  const { results, more } = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = models.filter((m) => {
      if (excludeIds.includes(m.id)) return false;
      const haystack = `${m.name} ${m.labName} ${m.id}`.toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
    return { results: matches.slice(0, MAX_RESULTS), more: matches.length > MAX_RESULTS };
  }, [models, excludeIds, query]);

  const choose = (model: T) => {
    onSelect(model);
    setQuery("");
    setActiveIndex(0);
    setOpen(false);
  };

  const moveTo = (index: number) => {
    setActiveIndex(index);
    // Keep the active option visible while arrowing through a long list.
    listRef.current?.querySelector(`#${CSS.escape(optionId(index))}`)?.scrollIntoView({ block: "nearest" });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) setOpen(true);
        else if (results.length) moveTo(Math.min(activeIndex + 1, results.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        if (results.length) moveTo(Math.max(activeIndex - 1, 0));
        break;
      case "Enter": {
        const model = results[activeIndex];
        if (open && model) {
          event.preventDefault();
          choose(model);
        }
        break;
      }
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
        } else {
          setQuery("");
        }
        break;
    }
  };

  const expanded = open && !disabled;
  const active = results[activeIndex];

  return (
    <div className="relative">
      <label htmlFor={`${baseId}-input`} className="sr-only">
        {label}
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        id={`${baseId}-input`}
        type="text"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded && active ? optionId(activeIndex) : undefined}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={query}
        placeholder={disabled && disabledHint ? disabledHint : placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="h-10 w-full rounded-lg border border-border bg-bg pr-3 pl-9 text-sm placeholder:text-muted hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-60"
      />
      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={label}
        hidden={!expanded}
        className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-card"
      >
        {results.map((m, index) => (
          <li
            key={m.id}
            id={optionId(index)}
            role="option"
            aria-selected={index === activeIndex}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(m)}
            onMouseMove={() => index !== activeIndex && setActiveIndex(index)}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm",
              index === activeIndex && "bg-surface-2",
            )}
          >
            <BrandLogo labName={m.labName} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{m.name}</span>
              <span className="block truncate text-xs text-muted">
                {m.labName} · <span className="font-mono">{m.id}</span>
              </span>
            </span>
            <span className="shrink-0 font-mono text-xs text-muted tabular-nums">{formatPrice(m.pricing.input)}</span>
          </li>
        ))}
        {results.length === 0 ? <li role="option" aria-selected={false} aria-disabled className="px-3 py-6 text-center text-sm text-muted">No models found.</li> : null}
        {more ? (
          <li role="option" aria-selected={false} aria-disabled className="px-3 py-2 text-center text-xs text-muted">Showing the first {MAX_RESULTS}. Type to narrow down.</li>
        ) : null}
      </ul>
    </div>
  );
}
