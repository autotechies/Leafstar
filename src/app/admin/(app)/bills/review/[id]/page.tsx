import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/modules/admin-shell/PageHeader";
import { BillReview } from "@/modules/bills/components/BillReview";
import { loadBill } from "@/modules/bills/queries";

export const metadata: Metadata = { title: "Review bill" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let data;
  try {
    data = await loadBill(id);
  } catch {
    notFound();
  }
  return <BillReview bill={data.bill} options={data.options} nextDraftId={data.nextDraftId} history={data.history} />;
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <>
      <PageHeader title="Review bill" description="Check each line against the original. Nothing is deducted until you press Deduct stock." />
      <Suspense fallback={<Skeleton className="h-96 w-full" rounded="lg" />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}
