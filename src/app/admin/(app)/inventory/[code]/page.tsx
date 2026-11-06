import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/Feedback";
import { ArticleDetail } from "@/modules/inventory/components/ArticleDetail";
import { loadArticle } from "@/modules/inventory/queries";

export const metadata: Metadata = { title: "Article" };

async function Content({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const data = await loadArticle(decodeURIComponent(code));
  return <ArticleDetail article={data.article} movements={data.movements} brands={data.brands} />;
}

export default function Page({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" rounded="lg" />}>
      <Content params={params} />
    </Suspense>
  );
}
