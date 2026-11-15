import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/Feedback";
import { BuyerDossierView } from "@/modules/crm/components/BuyerDossierView";
import { loadBuyerDossier } from "@/modules/crm/queries";

export const metadata: Metadata = { title: "Customer Dossier" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dossier = await loadBuyerDossier(id);
  if (!dossier) notFound();
  return <BuyerDossierView initialDossier={dossier} />;
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" rounded="lg" />}>
      <Content params={params} />
    </Suspense>
  );
}
