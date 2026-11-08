import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/modules/admin-shell/PageHeader";
import { LeadBoard } from "@/modules/crm/components/LeadBoard";
import { loadBoard } from "@/modules/crm/queries";

export const metadata: Metadata = { title: "CRM" };

async function Content() {
  return <LeadBoard leads={await loadBoard()} />;
}

export default function Page() {
  return (
    <>
      <PageHeader
        title="CRM"
        description="Your leads from New to Won. Drag a card, or change its stage from the menu on the card."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/admin/crm/buyers" className={buttonClasses({ variant: "secondary" })}>Buyers</Link>
            <Link href="/admin/crm?add=1" scroll={false} className={buttonClasses()}>
              <Plus aria-hidden="true" className="size-icon" />
              Add a lead
            </Link>
          </div>
        }
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" rounded="lg" />}>
        <Content />
      </Suspense>
    </>
  );
}
