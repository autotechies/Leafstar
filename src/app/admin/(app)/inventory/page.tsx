import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/modules/admin-shell/PageHeader";
import { InventoryList } from "@/modules/inventory/components/InventoryList";
import { loadInventory } from "@/modules/inventory/queries";
import { filtersFromParams } from "@/modules/inventory/status";

export const metadata: Metadata = { title: "Inventory" };

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [data, params] = await Promise.all([loadInventory(), searchParams]);
  return <InventoryList articles={data.articles} brands={data.brands} initial={filtersFromParams(params)} />;
}

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <>
      <PageHeader title="Inventory" description="Every article, its stock and whether buyers can see it." action={<Link href="/admin/stock/add" className={buttonClasses()}>Add stock</Link>} />
      <Suspense fallback={<Skeleton className="h-96 w-full" rounded="lg" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}
