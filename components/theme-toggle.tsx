"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  THEME_STORAGE_KEY,
  isThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

/*
 * The preference lives in localStorage, which is an "external store" from
 * React's point of view, so we read it with useSyncExternalStore. On the server
 * (and during hydration) the snapshot is `null`, so no button is shown as
 * pressed until the client knows the real value. That avoids a hydration
 * mismatch without a "mounted" useEffect flag.
 */
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback); // sync across tabs
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): ThemePreference | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

const getServerSnapshot = (): ThemePreference | null => null;

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

function applyTheme(preference: ThemePreference) {
  const resolved: ResolvedTheme =
    preference === "system" ? (darkQuery().matches ? "dark" : "light") : preference;
  document.documentElement.dataset.theme = resolved;
}

function setPreference(preference: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage blocked: the theme still applies for this page view.
  }
  applyTheme(preference);
  listeners.forEach((notify) => notify());
}

const options: Array<{ value: ThemePreference; label: string; Icon: LucideIcon }> = [
  { value: "light", label: "Light theme", Icon: Sun },
  { value: "system", label: "System theme", Icon: Monitor },
  { value: "dark", label: "Dark theme", Icon: Moon },
];

export function ThemeToggle() {
  const preference = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // When following the OS, react live to the OS switching light/dark.
  useEffect(() => {
    if (preference !== "system") return;
    const query = darkQuery();
    const onChange = () => applyTheme("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  return (
    <div role="group" aria-label="Color theme" className="flex items-center rounded-lg border border-border bg-surface p-0.5">
      {options.map(({ value, label, Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={active}
            title={label}
            onClick={() => setPreference(value)}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md transition-colors duration-150",
              active ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
