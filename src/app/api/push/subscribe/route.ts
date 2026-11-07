import { NextResponse } from "next/server";
import { z } from "zod";
import { apiStaff, isSameOrigin, jsonError } from "@/lib/api";
import { supabaseServer } from "@/lib/supabase/server";

/* A staff member's phone or browser asking for alerts (or stopping them). Stored against that person only (RLS enforces it). */

const subscription = z.object({ endpoint: z.url().max(1000), keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(8).max(100) }) });

export async function POST(request: Request) {
  if (!(await isSameOrigin(request))) return jsonError("This request was not accepted.", 403);
  const staff = await apiStaff();
  if (!staff) return jsonError("Please sign in again.", 401);
  const parsed = subscription.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("That device could not be registered.", 400);
  const supabase = await supabaseServer();
  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: staff.id, endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth, user_agent: request.headers.get("user-agent")?.slice(0, 200) ?? null },
    { onConflict: "endpoint" },
  );
  if (error) return jsonError("Could not turn on alerts. Try again.", 500);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await isSameOrigin(request))) return jsonError("This request was not accepted.", 403);
  const staff = await apiStaff();
  if (!staff) return jsonError("Please sign in again.", 401);
  const parsed = z.object({ endpoint: z.url().max(1000) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("That request was not understood.", 400);
  const supabase = await supabaseServer();
  await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint).eq("user_id", staff.id);
  return NextResponse.json({ ok: true });
}
