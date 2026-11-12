"use client";

import { useSyncExternalStore } from "react";
import { CONSENT_COOKIE, UTM_COOKIE, readCookie, type ConsentChoice } from "@/lib/utm";

/*
 * The visitor's cookie choice, stored in a first-party cookie (not
 * localStorage) so /api/track can verify consent on the server too.
 * Remembering the choice itself is strictly necessary, so it needs no consent.
 *
 * Snapshot values: null = not chosen yet (show the banner),
 * "unknown" = server render / before hydration (render nothing).
 */
export type ConsentState = ConsentChoice | null | "unknown";

const ONE_YEAR = 60 * 60 * 24 * 365;
const listeners = new Set<() => void>();
let bannerReopened = false;

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${secure}`;
}

function getSnapshot(): ConsentState {
  const value = readCookie(document.cookie, CONSENT_COOKIE);
  return value === "analytics" || value === "essential" ? value : null;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

const notify = () => listeners.forEach((l) => l());

export function useConsent(): ConsentState {
  return useSyncExternalStore(subscribe, getSnapshot, () => "unknown");
}

/** Whether the banner should show even though a choice exists ("Cookie settings" link). */
export function useBannerReopened(): boolean {
  return useSyncExternalStore(subscribe, () => bannerReopened, () => false);
}

export function reopenBanner() {
  bannerReopened = true;
  notify();
}

export function setConsent(choice: ConsentChoice) {
  const previous = getSnapshot();
  writeCookie(CONSENT_COOKIE, choice, ONE_YEAR);
  bannerReopened = false;
  if (choice === "essential") {
    // Respect a changed mind: drop the attribution cookie and delete stored page views.
    writeCookie(UTM_COOKIE, "", 0);
    if (previous === "analytics") void fetch("/api/track", { method: "DELETE", keepalive: true }).catch(() => {});
  }
  notify();
}

export function writeFirstTouchCookie(value: string, maxAgeSeconds: number) {
  writeCookie(UTM_COOKIE, value, maxAgeSeconds);
}

export function hasFirstTouchCookie(): boolean {
  return readCookie(document.cookie, UTM_COOKIE) !== undefined;
}
