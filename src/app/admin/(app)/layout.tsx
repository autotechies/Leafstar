import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { AdminShell } from "@/modules/admin-shell/AdminShell";
import { AssistantLoader, InboxBadgeLoader, UserMenuLoader } from "@/modules/admin-shell/loaders";
import { requireStaff } from "@/modules/auth/session";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Leaf Star admin" },
  robots: { index: false, follow: false },
};

/**
 * Sends anyone who is not signed-in staff away. Pages that show data ALSO check for themselves
 * (layouts and pages render at the same time, so this alone would not protect their data).
 */
async function StaffOnly() {
  await requireStaff();
  return null;
}

export default function AdminAppLayout({ children }: { children: ReactNode }) {
  return (
    <AdminShell
      userMenu={
        <Suspense fallback={<div className="skeleton size-control rounded-full" aria-hidden="true" />}>
          <UserMenuLoader />
        </Suspense>
      }
      assistant={
        <Suspense fallback={null}>
          <AssistantLoader />
        </Suspense>
      }
      inboxBadge={
        <Suspense fallback={null}>
          <InboxBadgeLoader />
        </Suspense>
      }
    >
      <Suspense fallback={null}>
        <StaffOnly />
      </Suspense>
      {children}
    </AdminShell>
  );
}
