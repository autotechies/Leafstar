import { CountBadge } from "@/components/ui/Badge";
import { supabaseServer } from "@/lib/supabase/server";
import { lookupStaff } from "@/modules/auth/session";
import { loadCounts, loadSince, newThings } from "@/modules/assistant/briefing";
import { AssistantLauncher } from "@/modules/assistant/components/AssistantLauncher";
import { UserMenu } from "./UserMenu";

/* Small server parts of the shell. Each sits inside its own <Suspense>, so the shell paints at once. */

export async function UserMenuLoader() {
  const result = await lookupStaff();
  if (result.status !== "ok") return null;
  return <UserMenu name={result.staff.name} email={result.staff.email} />;
}

/** Count of people waiting for a reply (one per phone number), shown next to Inbox. */
export async function InboxBadgeLoader() {
  const result = await lookupStaff();
  if (result.status !== "ok" || result.staff.needsSecondStep) return null;
  const supabase = await supabaseServer();
  const { count } = await supabase.from("inbox_open_by_contact").select("contact_key", { count: "exact", head: true });
  return <CountBadge count={count ?? 0} label="people waiting for a reply" />;
}

/** The assistant button, with the number of NEW things since the owner last marked them as seen. */
export async function AssistantLoader() {
  const result = await lookupStaff();
  if (result.status !== "ok" || result.staff.needsSecondStep) return null;
  let count = 0;
  try {
    const { since } = await loadSince();
    count = newThings(await loadCounts(since));
  } catch {
    // The button still works; the briefing tab will show its own message.
  }
  return <AssistantLauncher newCount={count} />;
}
