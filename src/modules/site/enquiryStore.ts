"use client";

import { useSyncExternalStore } from "react";

/*
  The enquiry list (AGENTS.md §7): a buyer collects articles and sends ONE request. It lives in the
  browser only (localStorage) until sent; nothing is stored on the server before they press Send.
*/

export interface EnquiryItem {
  /** articleId + colourId, so the same article in two colours is two rows. */
  key: string;
  articleId: string;
  code: string;
  name: string;
  colourId: string | null;
  colours: Array<{ id: string; name: string; hex: string }>;
  quantity: number | null;
  moq: number;
  thumb: string | null;
}

const STORAGE_KEY = "ls-enquiry-v1";
const EMPTY: EnquiryItem[] = [];
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cached: EnquiryItem[] = EMPTY;

function read(): EnquiryItem[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return cached;
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cached = Array.isArray(parsed) ? (parsed as EnquiryItem[]).filter((i) => i && typeof i.key === "string" && typeof i.articleId === "string") : EMPTY;
  } catch {
    cached = EMPTY;
  }
  return cached;
}

function write(items: EnquiryItem[]) {
  cached = items.length ? items : EMPTY;
  try {
    cachedRaw = JSON.stringify(items);
    window.localStorage.setItem(STORAGE_KEY, cachedRaw);
  } catch {
    // Storage blocked (private window): the list still works for this visit.
    cachedRaw = null;
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const enquiry = {
  add(item: Omit<EnquiryItem, "key" | "quantity"> & { quantity?: number | null }) {
    const key = `${item.articleId}:${item.colourId ?? "any"}`;
    const items = read();
    if (items.some((i) => i.key === key)) return;
    write([...items, { ...item, key, quantity: item.quantity ?? null }]);
  },
  remove(key: string) {
    write(read().filter((i) => i.key !== key));
  },
  /** Removes every row of one article (the card's toggle button). */
  removeArticle(articleId: string) {
    write(read().filter((i) => i.articleId !== articleId));
  },
  update(key: string, change: Partial<Pick<EnquiryItem, "colourId" | "quantity">>) {
    write(read().map((i) => (i.key === key ? { ...i, ...change } : i)));
  },
  clear() {
    write([]);
  },
};

export function useEnquiry(): EnquiryItem[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

const noopSubscribe = () => () => undefined;
/** False while the server renders, true once the page runs in the browser (so the saved list is only judged then). */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
