import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/modules/admin-shell/PageHeader";
import { AddStockClient } from "@/modules/stock/components/AddStockClient";
import { loadAddStock } from "@/modules/stock/queries";

export const metadata: Metadata = { title: "Add stock" };

async function Content() {
  const data = await loadAddStock();
  return <AddStockClient data={data} />;
}

export default function Page() {
  return (
    <>
      <PageHeader title="Add stock" description="New articles, production for existing ones, or your Excel file. Every save can be undone for 15 seconds." />
      <Suspense fallback={<Skeleton className="h-96 w-full" rounded="lg" />}>
        <Content />
      </Suspense>
    </>
  );
}
