"use client";

import { useEffect, useRef } from "react";

/**
 * 2px reading-progress line at the very top, used on long pages only
 * (model detail, home with FAQ, privacy). Updated via a ref and
 * requestAnimationFrame, so scrolling never triggers React re-renders.
 * Decorative, so hidden from assistive tech.
 */
export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (barRef.current) barRef.current.style.transform = `scaleX(${progress})`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      ref={barRef}
      aria-hidden
      className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-fg"
      style={{ transform: "scaleX(0)" }}
    />
  );
}
