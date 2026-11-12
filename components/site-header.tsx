import Link from "next/link";
import { Suspense } from "react";
import { Globe } from "lucide-react";
import { NavLinks, NavList } from "@/components/nav-links";
import { MobileMenu } from "@/components/site/mobile-menu";
import { SearchButton } from "@/components/site/search-button";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Server Component shell; nav links, search, theme and menu are small client islands.
 * Desktop: inline nav. Mobile: a menu button opens a slide-down dialog.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 rounded-md text-[15px] font-semibold tracking-tight">
          <Globe className="size-5" aria-hidden />
          ModelAtlas
        </Link>
        <nav aria-label="Main" className="hidden md:block">
          <Suspense fallback={<NavList pathname={null} />}>
            <NavLinks />
          </Suspense>
        </nav>
        <div className="flex items-center gap-2">
          <SearchButton />
          {/* On small screens the theme switch lives in the menu to save space. */}
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
