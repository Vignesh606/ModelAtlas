"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { setConsent, useBannerReopened, useConsent } from "@/lib/consent";

/**
 * Small card asking for analytics consent. Nothing analytics-related runs
 * until "Accept analytics"; the session cookie is strictly necessary and is
 * explained, not asked for. Hidden during server render (choice unknown) so
 * returning visitors never see it flash.
 */
export function CookieBanner() {
  const consent = useConsent();
  const reopened = useBannerReopened();
  if (consent === "unknown" || (consent !== null && !reopened)) return null;

  return (
    <section
      aria-labelledby="cookie-title"
      className="pointer-events-auto w-full rounded-2xl border border-border bg-surface p-4 shadow-card sm:max-w-sm"
    >
      <h2 id="cookie-title" className="text-sm font-semibold">
        Cookies
      </h2>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">
        We use one strictly necessary cookie to keep your playground history tied to this browser. With your permission
        we also record anonymous page views and campaign (UTM) parameters.{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-fg">
          Privacy
        </Link>
      </p>
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1" onClick={() => setConsent("essential")}>
          Essential only
        </Button>
        <Button variant="primary" size="sm" className="flex-1" onClick={() => setConsent("analytics")}>
          Accept analytics
        </Button>
      </div>
    </section>
  );
}
