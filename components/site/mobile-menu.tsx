"use client";

import { Suspense, useEffect, useRef, useState, type MouseEvent } from "react";
import { Menu, X } from "lucide-react";
import { NavLinks, NavList } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";
import { lockScroll, unlockScroll } from "@/lib/scroll-lock";

/**
 * Small-screen navigation: a slide-down panel built on a native modal
 * <dialog>. showModal() makes the rest of the page inert (focus trap) and
 * closes on Escape; we add body scroll lock, aria-expanded on the trigger,
 * close-on-link-click and focus return to the trigger.
 */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = triggerRef.current; // captured now; refs may change before cleanup
    if (!dialog || !open) return;
    if (!dialog.open) dialog.showModal();
    lockScroll();
    return () => {
      unlockScroll();
      if (dialog.open) dialog.close();
      trigger?.focus(); // return focus to the menu button
    };
  }, [open]);

  // Close when a link inside is followed, or when the backdrop is clicked.
  const onDialogClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget || (event.target as HTMLElement).closest("a")) setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-muted transition-colors duration-150 hover:border-border-strong hover:text-fg md:hidden"
      >
        <Menu className="size-4" aria-hidden />
      </button>
      <dialog
        ref={dialogRef}
        id="mobile-menu"
        aria-label="Menu"
        onClose={() => setOpen(false)}
        onClick={onDialogClick}
        className="mobile-menu m-0 mt-0 w-full max-w-none border-b border-border bg-bg p-0 text-fg backdrop:bg-black/40"
      >
        <div className="flex h-14 items-center justify-between px-4">
          <span className="text-[15px] font-semibold tracking-tight">Menu</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-muted transition-colors duration-150 hover:text-fg"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <nav aria-label="Main" className="px-2 pb-4">
          <Suspense fallback={<NavList pathname={null} className="flex-col items-stretch" />}>
            <NavLinks className="flex-col items-stretch [&_a]:block [&_a]:py-3 [&_a]:text-base" />
          </Suspense>
        </nav>
        <div className="flex items-center justify-between border-t border-border px-4 py-3 sm:hidden">
          <span className="text-sm text-muted">Theme</span>
          <ThemeToggle />
        </div>
      </dialog>
    </>
  );
}
