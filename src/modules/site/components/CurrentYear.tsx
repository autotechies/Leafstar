"use client";
import { useEffect, useState } from "react";

/** The year for the footer, filled in by the browser so the page itself can be built ahead of time. */
export function CurrentYear() {
  const [year, setYear] = useState<number | null>(null);
  useEffect(() => setYear(new Date().getFullYear()), []);
  return <>{year ?? ""}</>;
}
