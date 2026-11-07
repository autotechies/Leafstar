import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/modules/admin-shell/PageHeader";
import { DashboardView } from "@/modules/dashboard/components/DashboardView";
import { loadDashboard, parseRange } from "@/modules/dashboard/queries";

export const metadata: Metadata = { title: "Dashboard" };

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const range = Array.isArray(params.range) ? params.range[0] : params.range;
  return <DashboardView d={await loadDashboard(parseRange(range))} />;
}

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <>
      <PageHeader title="Dashboard" description="What needs your attention today and how your stock is doing." />
      <Suspense fallback={<Skeleton className="h-96 w-full" rounded="lg" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}
