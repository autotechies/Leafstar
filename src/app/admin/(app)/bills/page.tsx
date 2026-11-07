import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/modules/admin-shell/PageHeader";
import { BillHistory } from "@/modules/bills/components/BillHistory";
import { loadHistory } from "@/modules/bills/queries";

export const metadata: Metadata = { title: "Bills" };

async function Content() {
  return <BillHistory rows={await loadHistory()} />;
}

export default function Page() {
  return (
    <>
      <PageHeader
        title="Bills"
        description="Every scanned bill: what it deducted and a confirmed undo."
        action={<Link href="/admin/bills/scan" className={buttonClasses()}>Scan bills</Link>}
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" rounded="lg" />}>
        <Content />
      </Suspense>
    </>
  );
}
