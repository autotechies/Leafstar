"use server";

import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/session";

type Result = { ok: true } | { ok: false; error: string };

const input = z.object({ ids: z.array(z.uuid()).min(1).max(200), via: z.enum(["call", "whatsapp", "sms", "other"]), note: z.string().trim().max(300).optional() });

export async function handleInboxAction(raw: unknown): Promise<Result> {
  await requireStaff(undefined, "/admin/inbox");
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Choose how you replied." };
  const { data, error } = await (await supabaseServer()).rpc("handle_inbox_items", { p_ids: parsed.data.ids, p_via: parsed.data.via, p_note: parsed.data.note || undefined });
  if (error) return { ok: false, error: "Could not save that. Try again." };
  return (data ?? 0) > 0 ? { ok: true } : { ok: false, error: "Someone else already handled this." };
}

/** "Not needed": spam, a test or a wrong tap. Kept in the history, never counted as waiting. */
export async function dismissInboxAction(ids: string[]): Promise<Result> {
  const staff = await requireStaff(undefined, "/admin/inbox");
  const parsed = z.array(z.uuid()).min(1).max(200).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Nothing to dismiss." };
  const { error } = await (await supabaseServer())
    .from("inbox_items")
    .update({ status: "dismissed", handled_at: new Date().toISOString(), handled_by: staff.id, handled_note: "Not needed" })
    .in("id", parsed.data)
    .eq("status", "unanswered");
  return error ? { ok: false, error: "Could not save that. Try again." } : { ok: true };
}
