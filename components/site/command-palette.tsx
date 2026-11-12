"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CircleHelp, FileText, Plus, Search } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { OPEN_FAQ_EVENT } from "@/components/site/faq";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { addCompareItem, useCompareItems } from "@/lib/compare-store";
import { formatPrice } from "@/lib/format";
import { modelHref } from "@/lib/routes";
import { lockScroll, unlockScroll } from "@/lib/scroll-lock";
import { FAQ, PAGES, matches } from "@/lib/site-search";

export const OPEN_SEARCH_EVENT = "modelatlas:open-search";

interface PaletteModel {
  id: string;
  name: string;
  labName: string;
  inputPrice: number | null;
}

type Result =
  | { kind: "page"; key: string; title: string; subtitle: string; href: string }
  | { kind: "faq"; key: string; title: string; subtitle: string; href: string }
  | { kind: "model"; key: string; title: string; subtitle: string; href: string; model: PaletteModel };

const GROUP_LABEL = { page: "Pages", model: "Models", faq: "FAQ" } as const;

// Loaded on first open and kept for the rest of the visit.
let modelCache: PaletteModel[] | null = null;
async function loadModels(): Promise<PaletteModel[]> {
  if (modelCache) return modelCache;
  const response = await fetch("/api/models");
  if (!response.ok) throw new Error(String(response.status));
  const data = (await response.json()) as { models: PaletteModel[] };
  modelCache = data.models;
  return modelCache;
}

/**
 * Site search (⌘K / Ctrl+K or the header button). A native modal <dialog>
 * provides the focus trap, Escape-to-close and top-layer stacking; inside, a
 * combobox + listbox like the model picker. Enter opens the active result;
 * Ctrl/⌘+Enter (or the footer button) adds the active model to the compare tray.
 */
export function CommandPalette() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [models, setModels] = useState<PaletteModel[] | null>(modelCache);
  const [loadFailed, setLoadFailed] = useState(false);
  const router = useRouter();
  const { show, toast } = useToast();
  const compareItems = useCompareItems();
  const id = useId();

  // Global shortcut and the header button's open event.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen);
    };
  }, []);

  // Keep the <dialog> element in sync with state; lock page scroll while open.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    if (!dialog.open) dialog.showModal();
    lockScroll();
    inputRef.current?.focus();
    loadModels()
      .then(setModels)
      .catch(() => setLoadFailed(true));
    return () => {
      unlockScroll();
      if (dialog.open) dialog.close();
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  };

  const results = useMemo<Result[]>(() => {
    const q = query.trim();
    const pages: Result[] = PAGES.filter((p) => !q || matches(q, p.title, p.description)).map((p) => ({
      kind: "page",
      key: `page:${p.href}`,
      title: p.title,
      subtitle: p.description,
      href: p.href,
    }));
    const modelResults: Result[] = q
      ? (models ?? [])
          .filter((m) => matches(q, m.name, m.labName, m.id))
          .slice(0, 8)
          .map((m) => ({ kind: "model", key: `model:${m.id}`, title: m.name, subtitle: m.labName, href: modelHref(m.id), model: m }))
      : [];
    const faq: Result[] = FAQ.filter((f) => (q ? matches(q, f.question, f.answer) : true))
      .slice(0, q ? 4 : 3)
      .map((f) => ({ kind: "faq", key: `faq:${f.id}`, title: f.question, subtitle: "FAQ", href: `/#faq-${f.id}` }));
    return [...pages, ...modelResults, ...faq];
  }, [query, models]);

  const active = results[Math.min(activeIndex, results.length - 1)];
  const optionId = (key: string) => `${id}-${key.replace(/[^a-zA-Z0-9-]/g, "_")}`;

  const addToCompare = (model: PaletteModel) => {
    if (compareItems.some((i) => i.id === model.id)) return show(`${model.name} is already in compare`);
    show(addCompareItem({ id: model.id, name: model.name, labName: model.labName }) ? `Added ${model.name} to compare` : "Compare is full (4 models)");
  };

  const activate = (result: Result) => {
    close();
    router.push(result.href);
    // Same-page hash changes don't fire "hashchange", so tell the FAQ directly.
    if (result.kind === "faq") setTimeout(() => window.dispatchEvent(new Event(OPEN_FAQ_EVENT)), 100);
  };

  const moveTo = (index: number) => {
    setActiveIndex(index);
    const target = results[index];
    if (target) listRef.current?.querySelector(`#${CSS.escape(optionId(target.key))}`)?.scrollIntoView({ block: "nearest" });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (results.length) moveTo((activeIndex + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length) moveTo((activeIndex - 1 + results.length) % results.length);
    } else if (event.key === "Enter" && active) {
      event.preventDefault();
      if ((event.metaKey || event.ctrlKey) && active.kind === "model") addToCompare(active.model);
      else activate(active);
    }
  };

  let lastKind: Result["kind"] | null = null;

  return (
    <dialog
      ref={dialogRef}
      aria-label="Search"
      onClose={close}
      // A click on the backdrop targets the <dialog> itself (content fills it otherwise).
      onClick={(e) => e.target === e.currentTarget && close()}
      className="m-auto mt-[10vh] w-[min(640px,calc(100%-2rem))] max-w-none overflow-hidden rounded-2xl border border-border bg-surface p-0 text-fg shadow-2xl backdrop:bg-black/50"
    >
      <div className="flex items-center gap-2 border-b border-border px-4">
        <Search className="size-4 shrink-0 text-muted" aria-hidden />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={active ? optionId(active.key) : undefined}
          aria-label="Search models, pages and FAQ"
          placeholder="Search models, pages and FAQ..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck={false}
          className="h-12 flex-1 bg-transparent text-sm placeholder:text-muted focus-visible:outline-none"
        />
        {open && !models && !loadFailed ? <Spinner label="Loading models" className="text-muted" /> : null}
        <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted">Esc</kbd>
      </div>

      <ul ref={listRef} id={`${id}-list`} role="listbox" aria-label="Results" className="max-h-[50vh] overflow-y-auto p-2">
        {results.length === 0 ? (
          <li role="option" aria-selected={false} aria-disabled className="px-3 py-8 text-center text-sm text-muted">
            No results for &ldquo;{query}&rdquo;.
          </li>
        ) : null}
        {results.map((result, index) => {
          const header = result.kind !== lastKind ? GROUP_LABEL[result.kind] : null;
          lastKind = result.kind;
          const isActive = active?.key === result.key;
          return (
            <li key={result.key} role="presentation">
              {header ? (
                <p aria-hidden className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">
                  {header}
                </p>
              ) : null}
              <div
                id={optionId(result.key)}
                role="option"
                aria-selected={isActive}
                onMouseMove={() => !isActive && setActiveIndex(index)}
                onClick={() => activate(result)}
                className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm", isActive && "bg-surface-2")}
              >
                {result.kind === "model" ? (
                  <BrandLogo labName={result.model.labName} size="sm" />
                ) : result.kind === "faq" ? (
                  <CircleHelp className="size-4 text-muted" aria-hidden />
                ) : (
                  <FileText className="size-4 text-muted" aria-hidden />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{result.title}</span>
                  <span className="block truncate text-xs text-muted">{result.subtitle}</span>
                </span>
                {result.kind === "model" ? (
                  <span className="font-mono text-xs text-muted tabular-nums">{formatPrice(result.model.inputPrice)}</span>
                ) : null}
              </div>
            </li>
          );
        })}
        {loadFailed && query.trim() ? (
          <li role="option" aria-selected={false} aria-disabled className="px-3 py-2 text-xs text-muted">
            Model search is unavailable right now.
          </li>
        ) : null}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-xs text-muted">
        <span>↑↓ to move · Enter to open{active?.kind === "model" ? " · Ctrl/⌘+Enter to add to compare" : ""}</span>
        {active?.kind === "model" ? (
          <button
            type="button"
            onClick={() => addToCompare(active.model)}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-fg transition-colors duration-150 hover:bg-surface-2"
          >
            <Plus className="size-3.5" aria-hidden />
            Add to compare
          </button>
        ) : null}
      </div>
      {toast}
    </dialog>
  );
}
