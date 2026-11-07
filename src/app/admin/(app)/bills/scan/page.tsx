import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/modules/admin-shell/PageHeader";
import { BillScanner } from "@/modules/bills/components/BillScanner";
import { loadQueue } from "@/modules/bills/queries";

export const metadata: Metadata = { title: "Scan bills" };

async function Content() {
  const initial = await loadQueue();
  return <BillScanner initial={initial} />;
}

export default function Page() {
  return (
    <>
      <PageHeader title="Scan bills" description="Upload many bills at once in any format. They are read, matched to your stock and reviewed by you before anything is deducted." />
      <Suspense fallback={<Skeleton className="h-96 w-full" rounded="lg" />}>
        <Content />
      </Suspense>
    </>
  );
}
