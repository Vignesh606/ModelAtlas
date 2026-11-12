"use client";

/**
 * Body scroll lock with a counter, so overlapping overlays (menu, palette)
 * don't unlock each other. Modal <dialog>s trap focus but don't stop the page
 * behind them from scrolling, hence this.
 */
let locks = 0;

export function lockScroll() {
  locks += 1;
  if (locks === 1) document.documentElement.style.overflow = "hidden";
}

export function unlockScroll() {
  locks = Math.max(0, locks - 1);
  if (locks === 0) document.documentElement.style.overflow = "";
}
