"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Feedback";

/* The form reads its saved draft from the browser, so it is only ever rendered in the browser. */
export const NewArticleForm = dynamic(() => import("./NewArticleForm"), {
  ssr: false,
  loading: () => <Skeleton className="h-96 w-full" rounded="lg" />,
});
