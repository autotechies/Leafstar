import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/session";
import type { ChatsData, FaqRow, SessionRow, UnansweredRow } from "./types";

export async function loadChats(): Promise<ChatsData> {
  await requireStaff(undefined, "/admin/chats");
  const supabase = await supabaseServer();
  const [{ data: sessions }, { data: unanswered }, { data: faqs }] = await Promise.all([
    supabase.from("chat_sessions").select("id, started_at, flagged, owner_note, article_id, visitor_id").order("started_at", { ascending: false }).limit(100),
    supabase.from("unanswered_questions").select("id, question, created_at, status").order("created_at", { ascending: false }).limit(200),
    supabase.from("faq_entries").select("id, topic, question, answer, is_active, sort_order").order("sort_order").order("question"),
  ]);
  const ids = (sessions ?? []).map((s) => s.id);
  const visitorIds = [...new Set((sessions ?? []).map((s) => s.visitor_id))];
  const articleIds = [...new Set((sessions ?? []).map((s) => s.article_id).filter((x): x is string => Boolean(x)))];
  const [{ data: messages }, { data: visitors }, { data: articles }] = await Promise.all([
    ids.length ? supabase.from("chat_messages").select("session_id, role, content, created_at").in("session_id", ids).order("created_at") : Promise.resolve({ data: [] as Array<{ session_id: string; role: string; content: string; created_at: string }> }),
    visitorIds.length ? supabase.from("visitors").select("id, name, phone").in("id", visitorIds) : Promise.resolve({ data: [] as Array<{ id: string; name: string | null; phone: string | null }> }),
    articleIds.length ? supabase.from("articles").select("id, code").in("id", articleIds) : Promise.resolve({ data: [] as Array<{ id: string; code: string }> }),
  ]);
  const count = new Map<string, number>();
  const first = new Map<string, string>();
  for (const m of messages ?? []) {
    count.set(m.session_id, (count.get(m.session_id) ?? 0) + 1);
    if (m.role === "user" && !first.has(m.session_id)) first.set(m.session_id, m.content);
  }
  const v = new Map((visitors ?? []).map((x) => [x.id, x]));
  const a = new Map((articles ?? []).map((x) => [x.id, x.code]));
  const sessionRows: SessionRow[] = (sessions ?? []).map((s) => ({
    id: s.id,
    startedAt: s.started_at,
    flagged: s.flagged,
    ownerNote: s.owner_note,
    articleCode: s.article_id ? a.get(s.article_id) ?? null : null,
    visitorName: v.get(s.visitor_id)?.name ?? null,
    visitorPhone: v.get(s.visitor_id)?.phone ?? null,
    messageCount: count.get(s.id) ?? 0,
    preview: first.get(s.id) ?? "",
  }));
  const unansweredRows: UnansweredRow[] = (unanswered ?? []).map((u) => ({ id: u.id, question: u.question, createdAt: u.created_at, status: u.status as "open" | "resolved" }));
  const faqRows: FaqRow[] = (faqs ?? []).map((f) => ({ id: f.id, topic: f.topic, question: f.question, answer: f.answer, isActive: f.is_active, sortOrder: f.sort_order }));
  return { sessions: sessionRows, unanswered: unansweredRows, faqs: faqRows };
}
