import { CAPABILITY_FILTERS, type CapabilityFilter } from "@/lib/catalog";
import { cn } from "@/lib/cn";

/** Toggle buttons (aria-pressed) for capability filters. Filters combine with AND. */
export function FilterPills({
  active,
  onToggle,
}: {
  active: CapabilityFilter[];
  onToggle: (cap: CapabilityFilter) => void;
}) {
  return (
    <div role="group" aria-label="Capability filters" className="flex flex-wrap gap-2">
      {CAPABILITY_FILTERS.map(({ key, label }) => {
        const pressed = active.includes(key);
        return (
          <button
            key={key}
            type="button"
            aria-pressed={pressed}
            onClick={() => onToggle(key)}
            className={cn(
              "h-8 rounded-lg border px-3 text-xs font-medium transition-colors duration-150",
              pressed
                ? "border-primary bg-primary text-primary-fg"
                : "border-border bg-bg text-fg hover:border-border-strong hover:bg-surface-2",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
