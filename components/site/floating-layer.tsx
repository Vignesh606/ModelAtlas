import { BackToTop } from "@/components/site/back-to-top";
import { Contact } from "@/components/site/contact";
import { CookieBanner } from "@/components/site/cookie-banner";

/*
 * One fixed layer for everything that floats at the bottom, so nothing
 * overlaps: flex-col-reverse on mobile stacks the buttons ABOVE a full-width
 * cookie banner; from `sm` it becomes a row (banner left, buttons right).
 * The layer is click-through (pointer-events-none) except for its children,
 * and it sits above the compare tray via --tray-offset (set by CompareTray).
 */
export function FloatingLayer() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex flex-col-reverse gap-3 p-4 sm:flex-row sm:items-end sm:justify-between"
      style={{ bottom: "var(--tray-offset, 0px)" }}
    >
      <CookieBanner />
      <div className="flex flex-col items-end gap-2 self-end sm:ml-auto">
        <BackToTop />
        <Contact />
      </div>
    </div>
  );
}
