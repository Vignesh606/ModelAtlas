"use client";

import { reopenBanner } from "@/lib/consent";

/** Re-opens the cookie banner so the visitor can change their choice. */
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={reopenBanner} className={className}>
      Cookie settings
    </button>
  );
}
