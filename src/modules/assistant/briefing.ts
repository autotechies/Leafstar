import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/session";
import { formatNumber } from "@/lib/numbers";
import { dayLabel, timeLabel } from "@/lib/when";
import type { Briefing, BriefingSection, Counts } from "./types";

/*
  "What changed since I was last here", for every admin section. Plain counting, no AI: it is always right,
  instant, and free. The assistant chat uses the same numbers when the owner asks about them.
*/

const FIRST_TIME_DAYS = 7;
const plural = (n: number, one: string, many = `${one}s`) => `${formatNumber(n)} ${n === 1 ? one : many}`;
const kindLabel: Record<string, string> = { callback_request: "Callback request", call_tap: "Tapped Call", chat: "Chat", request_price: "Price request", contact_form: "Message from the form", missed_call: "Missed call", whatsapp: "WhatsApp" };

/** The moment the owner last marked everything as seen. */
export async function loadSince(): Promise<{ since: string; firstTime: boolean }> {
  const staff = await requireStaff();
  const supabase = await supabaseServer();
  const { data } = await supabase.from("profiles").select("last_briefed_at").eq("id", staff.id).maybeSingle();
  if (data?.last_briefed_at) return { since: data.last_briefed_at, firstTime: false };
  return { since: new Date(Date.now() - FIRST_TIME_DAYS * 86_400_000).toISOString(), firstTime: true };
}

export async function loadCounts(since: string): Promise<Counts> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("briefing_counts", { p_since: since });
  if (error || !data) throw new Error("Could not count what is new.");
  return data as unknown as Counts;
}

/** The number on the assistant button: things that are NEW (not things that are merely still open). */
export function newThings(c: Counts): number {
  return c.inbox_new + c.leads_new + c.questions_new + c.buyers_new + c.chat_visitors + c.scans_failed;
}

export async function loadBriefing(): Promise<Briefing> {
  const { since, firstTime } = await loadSince();
  const supabase = await supabaseServer();
  const c = await loadCounts(since);
  const [{ data: inbox }, { data: leads }, { data: questions }] = await Promise.all([
    supabase.from("inbox_items").select("id, kind, name, phone, preview").gt("created_at", since).order("created_at", { ascending: false }).limit(4),
    supabase.from("leads").select("id, name, source, stage").gt("created_at", since).order("created_at", { ascending: false }).limit(4),
    supabase.from("unanswered_questions").select("id, question").eq("status", "open").gt("created_at", since).order("created_at", { ascending: false }).limit(3),
  ]);

  const sections: BriefingSection[] = [];
  const quiet: string[] = [];
  const add = (s: BriefingSection | null, quietName: string) => (s && (s.lines.length > 0 || s.items.length > 0) ? sections.push(s) : quiet.push(quietName));

  // Inbox
  const inboxLines: string[] = [];
  if (c.inbox_new) inboxLines.push(`${plural(c.inbox_new, "new message or call request", "new messages or call requests")}.`);
  if (c.inbox_waiting) inboxLines.push(`${plural(c.inbox_waiting, "item")} still waiting for your reply.`);
  add({ id: "inbox", title: "Inbox", href: "/admin/inbox", lines: inboxLines, attention: c.inbox_waiting > 0, items: (inbox ?? []).map((i) => ({ text: `${kindLabel[i.kind] ?? i.kind}${i.name ? `: ${i.name}` : ""}${i.preview ? ` — ${i.preview.slice(0, 70)}` : ""}`, href: "/admin/inbox" })) }, "Inbox");

  // CRM
  const crmLines: string[] = [];
  if (c.leads_new) crmLines.push(`${plural(c.leads_new, "new lead")}.`);
  if (c.leads_won) crmLines.push(`${plural(c.leads_won, "lead")} won.`);
  if (c.leads_lost) crmLines.push(`${plural(c.leads_lost, "lead")} lost.`);
  if (c.follow_ups_due) crmLines.push(`${plural(c.follow_ups_due, "follow-up")} due today or overdue.`);
  add({ id: "crm", title: "CRM", href: "/admin/crm", lines: crmLines, attention: c.follow_ups_due > 0 || c.leads_new > 0, items: (leads ?? []).map((l) => ({ text: `${l.name} (${l.stage})`, href: `/admin/crm/${l.id}` })) }, "CRM");

  // Chats
  const chatLines: string[] = [];
  if (c.chat_visitors) chatLines.push(`${plural(c.chat_visitors, "visitor")} chatted with the website assistant (${plural(c.chat_messages, "question")}).`);
  if (c.questions_new) chatLines.push(`${plural(c.questions_new, "question")} the assistant could not answer.`);
  else if (c.questions_open) chatLines.push(`${plural(c.questions_open, "unanswered question")} still open.`);
  add({ id: "chats", title: "Chats", href: "/admin/chats", lines: chatLines, attention: c.questions_open > 0, items: (questions ?? []).map((q) => ({ text: q.question.slice(0, 90), href: "/admin/chats" })) }, "Chats");

  // Inventory and Add stock
  const stockLines: string[] = [];
  if (c.stock_in) stockLines.push(`${plural(c.stock_in, "piece")} added to stock.`);
  if (c.stock_out) stockLines.push(`${plural(c.stock_out, "piece")} sold (deducted by bills).`);
  if (c.stock_corrections) stockLines.push(`${plural(c.stock_corrections, "correction")} made.`);
  if (c.articles_new) stockLines.push(`${plural(c.articles_new, "new article")} added.`);
  const watch: string[] = [];
  if (c.variants_out) watch.push(`${plural(c.variants_out, "colour-size")} out of stock`);
  if (c.variants_low) watch.push(`${plural(c.variants_low, "colour-size")} running low`);
  if (watch.length) stockLines.push(`${watch.join(", ")}.`);
  add({ id: "inventory", title: "Inventory and Add stock", href: "/admin/inventory", lines: stockLines, attention: c.variants_out > 0, items: [] }, "Inventory");

  // Bills
  const billLines: string[] = [];
  if (c.bills_drafts) billLines.push(`${plural(c.bills_drafts, "bill")} waiting for your check.`);
  if (c.bills_applied) billLines.push(`${plural(c.bills_applied, "bill")} applied (stock deducted).`);
  if (c.scans_failed) billLines.push(`${plural(c.scans_failed, "scan")} could not be read. Press Retry on the Scan bills page.`);
  if (c.scans_queued) billLines.push(`${plural(c.scans_queued, "bill")} still being read.`);
  add({ id: "bills", title: "Bills and Scan bills", href: c.bills_drafts ? "/admin/bills" : "/admin/bills/scan", lines: billLines, attention: c.bills_drafts > 0 || c.scans_failed > 0, items: [] }, "Bills");

  // Buyers
  add({ id: "buyers", title: "Buyers", href: "/admin/crm/buyers", lines: c.buyers_new ? [`${plural(c.buyers_new, "new buyer")} saved.`] : [], attention: false, items: [] }, "Buyers");

  return { since, firstTime, newCount: newThings(c), sections, quiet };
}

/** "Sat, 8 Nov 2026, 6:42 pm" style words for the top of the briefing. */
export function sinceLabel(since: string): string {
  return `${dayLabel(since)}, ${timeLabel(since)}`;
}
