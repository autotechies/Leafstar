import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/modules/admin-shell/PageHeader";
import { InboxView } from "@/modules/inbox/components/InboxView";
import { loadInbox } from "@/modules/inbox/queries";

export const metadata: Metadata = { title: "Inbox" };

async function Content() {
  return <InboxView data={await loadInbox()} />;
}

export default function Page() {
  return (
    <>
      <PageHeader title="Inbox" description="Buyers who tried to reach you, longest waiting first. Reply, then mark them as handled." />
      <Suspense fallback={<Skeleton className="h-96 w-full" rounded="lg" />}>
        <Content />
      </Suspense>
    </>
  );
}
