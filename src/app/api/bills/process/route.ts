import { NextResponse } from "next/server";
import { apiStaff, isSameOrigin, jsonError } from "@/lib/api";
import { rateLimitAllow } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { processNextJob } from "@/modules/bills/process";

/*
  Processes ONE queued bill per call (AGENTS.md §10): there is no always-running worker on the host, so the scan page
  calls this over and over, a few at a time, until the queue is empty.
*/

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await isSameOrigin(request))) return jsonError("Request refused.", 403);
  const staff = await apiStaff();
  if (!staff) return jsonError("Please sign in again.", 401);
  if (!(await rateLimitAllow(`bill-process:${staff.id}`, 600, 600))) return jsonError("Too many requests. Wait a minute.", 429);

  try {
    const outcome = await processNextJob(supabaseAdmin());
    return NextResponse.json({ ok: true, idle: outcome === null, ...(outcome ?? {}) });
  } catch (error) {
    console.error("[bills/process]", error);
    return jsonError("Could not process the queue. Try again.", 500);
  }
}
