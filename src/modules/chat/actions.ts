"use server";

import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/session";
import type { TranscriptMessage, VisitorThread } from "./types";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error = "Could not save that. Try again."): { ok: false; error: string } => ({ ok: false, error });

export async function loadTranscriptAction(sessionId: string): Promise<Result<{ messages: TranscriptMessage[] }>> {
  await requireStaff(undefined, "/admin/chats");
  if (!z.uuid().safeParse(sessionId).success) return fail("That chat was not found.");
  const { data, error } = await (await supabaseServer()).from("chat_messages").select("id, role, content, created_at").eq("session_id", sessionId).order("created_at");
  if (error) return fail("Could not load that chat.");
  return { ok: true, messages: (data ?? []).map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content, createdAt: m.created_at })) };
}

export async function loadVisitorChatAction(visitorId: string): Promise<Result<{ thread: VisitorThread }>> {
  await requireStaff(undefined, "/admin/chats");
  if (!z.uuid().safeParse(visitorId).success) return fail("That visitor was not found.");
  const supabase = await supabaseServer();
  const [{ data: visitor }, { data: sessions }] = await Promise.all([
    supabase.from("visitors").select("id, name, phone").eq("id", visitorId).maybeSingle(),
    supabase.from("chat_sessions").select("id, started_at, flagged, owner_note, article_id").eq("visitor_id", visitorId).order("started_at"),
  ]);
  if (!visitor) return fail("That visitor was not found.");
  const ids = (sessions ?? []).map((s) => s.id);
  const articleIds = [...new Set((sessions ?? []).map((s) => s.article_id).filter((x): x is string => Boolean(x)))];
  const [{ data: messages }, { data: articles }, { data: lead }] = await Promise.all([
    ids.length ? supabase.from("chat_messages").select("id, session_id, role, content, created_at").in("session_id", ids).order("created_at") : Promise.resolve({ data: [] as Array<{ id: string; session_id: string; role: string; content: string; created_at: string }> }),
    articleIds.length ? supabase.from("articles").select("id, code").in("id", articleIds) : Promise.resolve({ data: [] as Array<{ id: string; code: string }> }),
    visitor.phone ? supabase.from("leads").select("id, name, stage").eq("phone", visitor.phone).order("created_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const code = new Map((articles ?? []).map((x) => [x.id, x.code]));
  const thread: VisitorThread = {
    visitorId, name: visitor.name, phone: visitor.phone, leadId: lead?.id ?? null, leadName: lead?.name ?? null, leadStage: lead?.stage ?? null,
    sessions: (sessions ?? []).map((s) => ({
      id: s.id, startedAt: s.started_at, flagged: s.flagged, ownerNote: s.owner_note, articleCode: s.article_id ? code.get(s.article_id) ?? null : null,
      messages: (messages ?? []).filter((m) => m.session_id === s.id).map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content, createdAt: m.created_at })),
    })),
  };
  return { ok: true, thread };
}

export async function flagSessionAction(sessionId: string, flagged: boolean, note: string): Promise<Result> {
  await requireStaff(undefined, "/admin/chats");
  const parsed = z.object({ id: z.uuid(), flagged: z.boolean(), note: z.string().trim().max(500) }).safeParse({ id: sessionId, flagged, note });
  if (!parsed.success) return fail();
  const { error } = await (await supabaseServer()).from("chat_sessions").update({ flagged: parsed.data.flagged, owner_note: parsed.data.note || null }).eq("id", parsed.data.id);
  return error ? fail() : { ok: true };
}

const faqSchema = z.object({
  id: z.uuid().nullish(),
  topic: z.string().trim().max(60).nullish(),
  question: z.string().trim().min(3, "Write the question").max(300),
  answer: z.string().trim().min(3, "Write the answer").max(1500),
  isActive: z.boolean().default(true),
});

export async function saveFaqAction(input: unknown, fromUnansweredId?: string): Promise<Result> {
  await requireStaff(undefined, "/admin/chats");
  const parsed = faqSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the question and answer.");
  const supabase = await supabaseServer();
  const row = { topic: parsed.data.topic || null, question: parsed.data.question, answer: parsed.data.answer, is_active: parsed.data.isActive };
  if (parsed.data.id) {
    const { error } = await supabase.from("faq_entries").update(row).eq("id", parsed.data.id);
    return error ? fail() : { ok: true };
  }
  const { data, error } = await supabase.from("faq_entries").insert(row).select("id").single();
  if (error || !data) return fail();
  if (fromUnansweredId && z.uuid().safeParse(fromUnansweredId).success) {
    await supabase.from("unanswered_questions").update({ status: "resolved", faq_id: data.id }).eq("id", fromUnansweredId);
  }
  return { ok: true };
}

export async function deleteFaqAction(id: string): Promise<Result> {
  await requireStaff(undefined, "/admin/chats");
  if (!z.uuid().safeParse(id).success) return fail();
  const { error } = await (await supabaseServer()).from("faq_entries").delete().eq("id", id);
  return error ? fail() : { ok: true };
}

export async function resolveUnansweredAction(id: string): Promise<Result> {
  await requireStaff(undefined, "/admin/chats");
  if (!z.uuid().safeParse(id).success) return fail();
  const { error } = await (await supabaseServer()).from("unanswered_questions").update({ status: "resolved" }).eq("id", id);
  return error ? fail() : { ok: true };
}
