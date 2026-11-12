"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

const SHOW_AFTER_PX = 400;

/** Appears after 400px of scrolling; smooth scroll unless the user prefers reduced motion. */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  const toTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    // Move keyboard focus to the top too, so the next Tab starts at the content.
    document.getElementById("main")?.focus({ preventScroll: true });
  };

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Back to top"
      title="Back to top"
      className="pointer-events-auto inline-flex size-10 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-card transition-colors duration-150 hover:border-border-strong hover:text-fg"
    >
      <ArrowUp className="size-4" aria-hidden />
    </button>
  );
}
