import { after, NextResponse } from "next/server";
import { isSameOrigin, jsonError } from "@/lib/api";
import { rateLimitAllow } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notifyOwner } from "@/modules/notify/notify";

/*
  Someone tapped Call. The site cannot know whether the call connected (AGENTS.md §7), so the
  Inbox item only says "tapped Call". Rate limited so a bot cannot fill the Inbox.
*/

export async function POST(request: Request) {
  if (!(await isSameOrigin(request))) return jsonError("This request was not accepted.", 403);
  if (!(await rateLimitAllow(`call-tap:${await clientIp()}`, 5, 600))) return NextResponse.json({ ok: true });
  const { error } = await supabaseAdmin().from("inbox_items").insert({ kind: "call_tap", preview: "Tapped the Call button on the website" });
  if (error) console.error("[call-tap] insert failed", error);
  else after(() => notifyOwner({ title: "Someone tapped Call", body: "A visitor tapped the Call button on your website." }));
  return NextResponse.json({ ok: true });
}
