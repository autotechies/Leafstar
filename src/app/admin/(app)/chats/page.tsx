import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/modules/admin-shell/PageHeader";
import { ChatsAdmin } from "@/modules/chat/components/ChatsAdmin";
import { loadChats } from "@/modules/chat/queries";

export const metadata: Metadata = { title: "Chats" };

async function Content() {
  return <ChatsAdmin data={await loadChats()} />;
}

export default function Page() {
  return (
    <>
      <PageHeader title="Chats" description="What visitors asked the website assistant, questions it could not answer, and the answers you teach it." />
      <Suspense fallback={<Skeleton className="h-96 w-full" rounded="lg" />}>
        <Content />
      </Suspense>
    </>
  );
}
