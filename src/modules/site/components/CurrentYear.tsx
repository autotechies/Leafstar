"use client";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** The year for the footer, read in the browser so the page itself can be built ahead of time. */
export function CurrentYear() {
  const year = useSyncExternalStore(subscribe, () => new Date().getFullYear(), () => null);
  return <>{year ?? ""}</>;
}
