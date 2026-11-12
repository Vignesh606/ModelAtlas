"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export const NAV_ITEMS = [
  { href: "/", label: "Models" },
  { href: "/compare", label: "Compare" },
  { href: "/playground", label: "Playground" },
  { href: "/history", label: "History" },
] as const;

/**
 * Plain list of nav links. `pathname: null` renders without an active item;
 * that's the Suspense fallback used while the URL isn't known yet (see below).
 */
export function NavList({ pathname, className }: { pathname: string | null; className?: string }) {
  return (
    <ul className={cn("flex items-center gap-1", className)}>
      {NAV_ITEMS.map(({ href, label }) => {
        // "/" must match exactly; other sections also match their sub-routes.
        const active = pathname !== null && (href === "/" ? pathname === "/" : pathname.startsWith(href));
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors duration-150",
                active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Client island only because it needs the current pathname for aria-current.
 * With Cache Components, usePathname suspends on routes whose params are only
 * known at request time (e.g. /history/[id]), so callers wrap this in
 * <Suspense fallback={<NavList pathname={null} />}>.
 */
export function NavLinks({ className }: { className?: string }) {
  return <NavList pathname={usePathname()} className={className} />;
}
