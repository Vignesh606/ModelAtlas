"use client";

import { useSyncExternalStore } from "react";
import { Search } from "lucide-react";
import { OPEN_SEARCH_EVENT } from "@/components/site/command-palette";

const noopSubscribe = () => () => {};
// Server and first render say "Ctrl"; Apple devices switch to ⌘ after hydration.
const useIsApple = () =>
  useSyncExternalStore(noopSubscribe, () => /Mac|iPhone|iPad/.test(navigator.userAgent), () => false);

/** Header search trigger: icon-only on small screens, labelled with its shortcut on larger ones. */
export function SearchButton() {
  const apple = useIsApple();
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))}
      aria-label="Search models, pages and FAQ"
      aria-keyshortcuts="Control+K Meta+K"
      className="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-surface px-2 text-sm text-muted transition-colors duration-150 hover:border-border-strong hover:text-fg sm:w-52 sm:px-3"
    >
      <Search className="size-4" aria-hidden />
      <span className="hidden flex-1 text-left sm:inline">Search...</span>
      <kbd className="hidden rounded border border-border px-1.5 font-mono text-[10px] sm:inline">{apple ? "⌘K" : "Ctrl K"}</kbd>
    </button>
  );
}
