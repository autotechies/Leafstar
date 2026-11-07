"use client";

import { ErrorState } from "@/components/ui/Feedback";

export default function SiteError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState description="Something went wrong on our side. Please try again, or call us." onRetry={reset} className="py-24" />;
}
