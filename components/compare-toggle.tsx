"use client";

import { Check, Plus } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { MAX_COMPARE } from "@/lib/compare-url";
import { addCompareItem, removeCompareItem, useCompareItems, type CompareItem } from "@/lib/compare-store";

/** Adds/removes a model from the compare tray. "icon" for table rows/cards, "button" for the detail page. */
export function CompareToggle({ item, variant = "icon" }: { item: CompareItem; variant?: "icon" | "button" }) {
  const items = useCompareItems();
  const selected = items.some((i) => i.id === item.id);
  const full = !selected && items.length >= MAX_COMPARE;

  const label = selected
    ? `Remove ${item.name} from comparison`
    : full
      ? `Comparison is full (${MAX_COMPARE} models)`
      : `Add ${item.name} to comparison`;

  const onClick = () => (selected ? removeCompareItem(item.id) : addCompareItem(item));
  const Icon = selected ? Check : Plus;

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={full}
        aria-pressed={selected}
        title={full ? label : undefined}
        className={buttonClasses("secondary")}
      >
        <Icon className="size-4" aria-hidden />
        {selected ? "Added to compare" : "Add to compare"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={full}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      className={cn(
        "relative z-10 inline-flex size-8 items-center justify-center rounded-md border transition-colors duration-150 disabled:opacity-40",
        selected
          ? "border-border-strong bg-surface-2 text-fg"
          : "border-border text-muted hover:border-border-strong hover:text-fg",
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
