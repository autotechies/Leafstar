import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/Feedback";
import { ErrorState } from "@/components/ui/Feedback";
import { loadArticle, loadCatalog, loadSettings } from "@/modules/site/data";
import { ArticleView } from "@/modules/site/components/ArticleView";
import { Section } from "@/modules/site/components/Layout";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const { articles } = await loadCatalog();
  const a = articles.find((x) => x.code.toLowerCase() === decodeURIComponent(code).toLowerCase());
  return a
    ? { title: `${a.name} (${a.code})`, description: `${a.name}: ${[a.fabric, a.pattern].filter(Boolean).join(", ") || a.garment}. Minimum order ${a.moq} pieces.` }
    : { title: "Article not found" };
}

async function Content({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [{ article, related, failed }, settings] = await Promise.all([loadArticle(decodeURIComponent(code)), loadSettings()]);
  if (failed) return <ErrorState description="We could not load this article just now. Please try again in a moment." />;
  if (!article) notFound();
  return <ArticleView article={article} related={related} contact={{ phone: settings?.phone ?? null, whatsapp: settings?.whatsapp ?? null }} />;
}

export default function ArticlePage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Section className="!py-8 lg:!py-12">
      <Suspense fallback={<Skeleton className="h-screen w-full" rounded="lg" />}>
        <Content params={params} />
      </Suspense>
    </Section>
  );
}
