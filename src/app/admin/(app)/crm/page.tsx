import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/modules/admin-shell/PageHeader";
import { LeadBoard } from "@/modules/crm/components/LeadBoard";
import { loadBoard } from "@/modules/crm/queries";

export const metadata: Metadata = { title: "CRM" };

async function Content() {
  return <LeadBoard leads={await loadBoard()} />;
}

export default function Page() {
  return (
    <>
      <PageHeader title="CRM" description="Your leads from New to Won. Drag a card, or use its Stage menu on a phone." />
      <Suspense fallback={<Skeleton className="h-96 w-full" rounded="lg" />}>
        <Content />
      </Suspense>
    </>
  );
}
