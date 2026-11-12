"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Minimal toast. The live region is always mounted (screen readers only
 * announce changes to a region that already exists); the message fades in
 * and clears itself after a few seconds.
 */
export function useToast(durationMs = 2500) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (text: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(text);
      timer.current = setTimeout(() => setMessage(null), durationMs);
    },
    [durationMs],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const toast = (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-fg shadow-card transition-opacity duration-200",
        message ? "opacity-100" : "opacity-0",
      )}
    >
      {message}
    </div>
  );

  return { show, toast };
}
