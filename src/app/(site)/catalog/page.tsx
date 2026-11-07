import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/Feedback";
import { loadCatalog, loadSettings } from "@/modules/site/data";
import { CatalogView } from "@/modules/site/components/CatalogView";
import { Section } from "@/modules/site/components/Layout";

export const metadata: Metadata = {
  title: "Catalog",
  description: "Shirts and pants available in wholesale lots from Leaf Star.",
};

async function Content({ searchParams }: { searchParams: Promise<{ garment?: string | string[] }> }) {
  const [{ articles, failed }, settings, params] = await Promise.all([loadCatalog(), loadSettings(), searchParams]);
  const garment = typeof params.garment === "string" ? params.garment : "";
  return (
    <CatalogView
      articles={articles}
      failed={failed}
      contact={{ phone: settings?.phone ?? null, whatsapp: settings?.whatsapp ?? null }}
      initialGarment={articles.some((a) => a.garment === garment) ? garment : ""}
    />
  );
}

export default function CatalogPage({ searchParams }: { searchParams: Promise<{ garment?: string | string[] }> }) {
  return (
    <Section className="!py-12 lg:!py-16">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="type-h1">Catalog</h1>
        <p className="max-w-prose type-body text-fg-muted">Shirts and pants in wholesale lots. Tap the plus to collect articles, then send one request for our price.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" rounded="lg" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </Section>
  );
}
