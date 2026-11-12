"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { buttonClasses } from "@/components/ui/button";
import { MAX_COMPARE, MIN_COMPARE, compareHref } from "@/lib/compare-url";
import { clearCompareItems, removeCompareItem, useCompareItems } from "@/lib/compare-store";

/**
 * Sticky bottom bar collecting up to 4 models while browsing. Hidden when empty
 * and on /compare itself (there the URL is the source of truth).
 */
export function CompareTray() {
  const items = useCompareItems();
  const pathname = usePathname();
  if (items.length === 0 || pathname.startsWith("/compare")) return null;
  return <TrayBar items={items} />;
}

function TrayBar({ items }: { items: ReturnType<typeof useCompareItems> }) {
  const barRef = useRef<HTMLElement>(null);

  // Publish the bar height so the floating buttons/cookie banner sit above it.
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty("--tray-offset", `${bar.offsetHeight}px`));
    observer.observe(bar);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--tray-offset");
    };
  }, []);

  const missing = MIN_COMPARE - items.length;

  return (
    <>
      {/* Spacer so the fixed bar never hides the end of the page. */}
      <div aria-hidden className="h-24" />
      <section
        ref={barRef}
        aria-label="Comparison tray"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface shadow-card"
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <p className="shrink-0 text-sm font-medium">
            <span className="max-sm:sr-only">Compare </span>
            <span className="font-mono text-muted tabular-nums">{items.length}/{MAX_COMPARE}</span>
          </p>
          <ul className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-0.5">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-bg py-1 pr-1 pl-1.5"
              >
                <BrandLogo labName={item.labName} size="sm" />
                <span className="max-w-32 truncate text-sm sm:max-w-44">{item.name}</span>
                <button
                  type="button"
                  onClick={() => removeCompareItem(item.id)}
                  aria-label={`Remove ${item.name} from comparison`}
                  className="inline-flex size-6 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={clearCompareItems} className={buttonClasses("ghost", "sm", "max-sm:hidden")}>
            Clear
          </button>
          {missing > 0 ? (
            <span className="shrink-0 text-xs text-muted">Add {missing} more</span>
          ) : (
            <Link href={compareHref(items.map((i) => i.id))} className={buttonClasses("primary", "sm", "shrink-0")}>
              Compare
            </Link>
          )}
        </div>
      </section>
    </>
  );
}
