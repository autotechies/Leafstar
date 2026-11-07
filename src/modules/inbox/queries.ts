import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/session";
import type { HandledRow, InboxContact, InboxData, InboxKind } from "./types";

export async function loadInbox(): Promise<InboxData> {
  await requireStaff(undefined, "/admin/inbox");
  const supabase = await supabaseServer();
  const [{ data: open }, { data: handled }] = await Promise.all([
    supabase.from("inbox_items").select("id, kind, name, phone, visitor_id, lead_id, article_id, preview, created_at").eq("status", "unanswered").order("created_at", { ascending: false }).limit(500),
    supabase.from("inbox_items").select("id, kind, name, phone, preview, handled_at, handled_via, handled_note").neq("status", "unanswered").order("handled_at", { ascending: false }).limit(60),
  ]);
  const articleIds = [...new Set((open ?? []).map((i) => i.article_id).filter((x): x is string => Boolean(x)))];
  const { data: articles } = articleIds.length ? await supabase.from("articles").select("id, code").in("id", articleIds) : { data: [] as Array<{ id: string; code: string }> };
  const code = new Map((articles ?? []).map((a) => [a.id, a.code]));

  // One card per person: grouped by phone number; people who left none stay separate (by browser).
  const groups = new Map<string, InboxContact>();
  for (const i of open ?? []) {
    const key = i.phone ?? `anon:${i.visitor_id ?? i.id}`;
    const g = groups.get(key) ?? { key, name: null, phone: i.phone, items: [], oldestAt: i.created_at, latestAt: i.created_at, leadId: null };
    g.name = g.name ?? i.name;
    g.leadId = g.leadId ?? i.lead_id;
    g.items.push({ id: i.id, kind: i.kind as InboxKind, preview: i.preview, createdAt: i.created_at, articleCode: i.article_id ? code.get(i.article_id) ?? null : null });
    if (i.created_at < g.oldestAt) g.oldestAt = i.created_at;
    if (i.created_at > g.latestAt) g.latestAt = i.created_at;
    groups.set(key, g);
  }
  const contacts = [...groups.values()].sort((a, b) => (a.oldestAt < b.oldestAt ? -1 : 1)); // longest waiting first
  const handledRows: HandledRow[] = (handled ?? []).map((h) => ({ id: h.id, kind: h.kind as InboxKind, name: h.name, phone: h.phone, preview: h.preview, handledAt: h.handled_at as string, via: h.handled_via, note: h.handled_note }));
  return { open: contacts, handled: handledRows, vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? null };
}
