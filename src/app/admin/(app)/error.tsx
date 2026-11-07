"use client";

import { ErrorState } from "@/components/ui/Feedback";

/* If one admin page fails, the menu stays and the owner can retry. The technical details go to the server log, not the screen. */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="This page could not load"
      description={`Something went wrong on our side. Try again. If it keeps happening, tell your developer this code: ${error.digest ?? "none"}.`}
      onRetry={reset}
      className="py-24"
    />
  );
}
