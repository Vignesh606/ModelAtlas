"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import { MAX_COMPARE } from "@/lib/compare-url";

/*
 * The compare tray: models collected while browsing, before opening /compare.
 * Stored in localStorage so it survives navigation and reloads, and exposed
 * through useSyncExternalStore so every component (row buttons, detail page,
 * tray) sees the same list without a context provider.
 * Each item keeps its display name so the tray renders without the model list.
 */

const STORAGE_KEY = "modelatlas-compare";

const itemSchema = z.object({ id: z.string(), name: z.string(), labName: z.string() });
export type CompareItem = z.infer<typeof itemSchema>;

const EMPTY: CompareItem[] = [];
let cache: { raw: string | null; items: CompareItem[] } = { raw: null, items: EMPTY };
const listeners = new Set<() => void>();

function read(): CompareItem[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  // useSyncExternalStore needs a stable reference while the data is unchanged,
  // so we only re-parse when the stored string changes.
  if (raw === cache.raw) return cache.items;
  let json: unknown = [];
  try {
    json = raw ? JSON.parse(raw) : [];
  } catch {
    // Corrupted value: treat as empty.
  }
  const parsed = z.array(itemSchema).safeParse(json);
  cache = { raw, items: parsed.success ? parsed.data.slice(0, MAX_COMPARE) : EMPTY };
  return cache.items;
}

function write(items: CompareItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage blocked: ignore, the tray just won't persist.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

export function useCompareItems(): CompareItem[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Returns false when the tray is already full. */
export function addCompareItem(item: CompareItem): boolean {
  const items = read();
  if (items.some((i) => i.id === item.id)) return true;
  if (items.length >= MAX_COMPARE) return false;
  write([...items, item]);
  return true;
}

export function removeCompareItem(id: string) {
  write(read().filter((i) => i.id !== id));
}

export function clearCompareItems() {
  write([]);
}
