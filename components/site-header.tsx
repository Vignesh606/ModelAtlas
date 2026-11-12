import Link from "next/link";
import { Suspense } from "react";
import { Globe } from "lucide-react";
import { NavLinks, NavList } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Server Component shell; only NavLinks and ThemeToggle ship JS.
 * Mobile: nav drops to a horizontally scrollable second row. Phase 6 replaces
 * this with an accessible slide-down menu (focus trap, Esc, scroll lock).
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 rounded-md text-[15px] font-semibold tracking-tight">
          <Globe className="size-5" aria-hidden />
          ModelAtlas
        </Link>
        <nav aria-label="Main" className="hidden md:block">
          <Suspense fallback={<NavList pathname={null} />}>
            <NavLinks />
          </Suspense>
        </nav>
        <ThemeToggle />
      </div>
      <nav aria-label="Main mobile" className="overflow-x-auto border-t border-border px-2 py-1.5 md:hidden">
        <Suspense fallback={<NavList pathname={null} />}>
          <NavLinks />
        </Suspense>
      </nav>
    </header>
  );
}
