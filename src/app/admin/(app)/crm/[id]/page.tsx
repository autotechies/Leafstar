import { Suspense } from "react";
import { redirect } from "next/navigation";
import { z } from "zod";

/* A link to one lead (from the Inbox, search, the dashboard) opens the board with that lead's drawer. */
async function Go({ params }: { params: Promise<{ id: string }> }): Promise<null> {
  const { id } = await params;
  redirect(z.uuid().safeParse(id).success ? `/admin/crm?lead=${id}` : "/admin/crm");
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <Go params={params} />
    </Suspense>
  );
}
