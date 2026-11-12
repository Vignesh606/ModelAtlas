import { cn } from "@/lib/cn";

/**
 * Lab avatar: a neutral monogram tile. We deliberately avoid real brand logos
 * (licensing, and the design system forbids saturated colors), so every lab
 * gets the same quiet treatment and is identified by its initial + name.
 */
export function BrandLogo({
  labName,
  size = "md",
  className,
}: {
  labName: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const initial = labName.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 font-semibold text-fg",
        size === "sm" && "size-5 text-[10px]",
        size === "md" && "size-8 text-xs",
        size === "lg" && "size-11 text-base",
        className,
      )}
    >
      {initial}
    </span>
  );
}
