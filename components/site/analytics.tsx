"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { hasFirstTouchCookie, useConsent, writeFirstTouchCookie } from "@/lib/consent";
import { UTM_MAX_AGE_SECONDS, encodeFirstTouch, parseFirstTouch } from "@/lib/utm";

/*
 * The landing URL and referrer are read once, when this module first loads in
 * the browser: before any component can rewrite the URL with replaceState
 * (the catalog and compare pages do). They stay in memory only; nothing is
 * written anywhere unless the visitor accepts analytics during this visit.
 */
const landing =
  typeof window === "undefined" ? null : { search: window.location.search, referrer: document.referrer };

/**
 * Sends a page view on each route change, only with analytics consent.
 * Renders nothing. Must sit inside <Suspense> (it reads usePathname).
 */
export function Analytics() {
  const consent = useConsent();
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (consent !== "analytics" || lastSent.current === pathname) return;
    lastSent.current = pathname;

    // First touch: written once per 30 days, from the URL the visitor landed on.
    let touch = null;
    if (!hasFirstTouchCookie() && landing) {
      touch = parseFirstTouch(landing.search, landing.referrer, window.location.origin, new Date());
      if (touch) writeFirstTouchCookie(encodeFirstTouch(touch), UTM_MAX_AGE_SECONDS);
    }

    // Only the path is sent (no query string, which may contain user input).
    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname, firstTouch: touch }),
      keepalive: true,
    }).catch(() => {});
  }, [consent, pathname]);

  return null;
}
