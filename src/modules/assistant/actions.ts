"use server";

import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/session";
import { loadBriefing, sinceLabel } from "./briefing";
import { askAssistant } from "./engine";
import type { AssistantReply, Briefing } from "./types";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export async function loadBriefingAction(): Promise<Result<{ briefing: Briefing; sinceText: string }>> {
  try {
    const briefing = await loadBriefing();
    return { ok: true, briefing, sinceText: sinceLabel(briefing.since) };
  } catch {
    return { ok: false, error: "Could not load what is new. Try again." };
  }
}

/** "Mark as seen": the next briefing starts from now. */
export async function markSeenAction(): Promise<Result> {
  const staff = await requireStaff();
  const { error } = await (await supabaseServer()).from("profiles").update({ last_briefed_at: new Date().toISOString() }).eq("id", staff.id);
  return error ? { ok: false, error: "Could not save that. Try again." } : { ok: true };
}

const askSchema = z.object({
  message: z.string().trim().min(1).max(600),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) })).max(20),
});

export async function askAssistantAction(input: unknown): Promise<Result<{ answer: AssistantReply }>> {
  const parsed = askSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Type a short question first." };
  return { ok: true, answer: await askAssistant(parsed.data) };
}
