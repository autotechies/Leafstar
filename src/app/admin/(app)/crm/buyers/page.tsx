import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/modules/admin-shell/PageHeader";
import { BuyersView } from "@/modules/crm/components/BuyersView";
import { loadBuyers } from "@/modules/crm/queries";

export const metadata: Metadata = { title: "Buyers" };

async function Content() {
  return <BuyersView buyers={await loadBuyers()} />;
}

export default function Page() {
  return (
    <>
      <PageHeader title="Buyers" description="Everyone who buys from you: what they bought, when, and the terms you agreed." />
      <Suspense fallback={<Skeleton className="h-96 w-full" rounded="lg" />}>
        <Content />
      </Suspense>
    </>
  );
}
