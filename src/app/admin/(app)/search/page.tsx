import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/modules/admin-shell/PageHeader";
import { SearchPageForm } from "@/modules/search/components/SearchPageForm";
import { SearchResultsView } from "@/modules/search/components/SearchResultsView";
import { searchAdmin } from "@/modules/search/queries";

export const metadata: Metadata = { title: "Search" };

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = Array.isArray(params.q) ? params.q[0] : params.q;
  return (
    <>
      <SearchPageForm initial={q ?? ""} />
      <SearchResultsView r={await searchAdmin(q ?? "")} />
    </>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <>
      <PageHeader title="Search" description="Find a SKU, article, buyer, lead or bill." />
      <div className="flex flex-col gap-6">
        <Suspense fallback={<Skeleton className="h-96 w-full" rounded="lg" />}>
          <Content searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}
