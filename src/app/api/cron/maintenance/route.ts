import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runMaintenance } from "@/modules/maintenance/run";

/*
  Scheduled housekeeping (Vercel Cron calls this; see vercel.json). Protected by CRON_SECRET:
  without the exact secret in the Authorization header it answers 401 and does nothing.
*/

export const maxDuration = 60;

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 24) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorised(request)) return NextResponse.json({ ok: false }, { status: 401 });
  const report = await runMaintenance(supabaseAdmin());
  return NextResponse.json({ ok: true, ...report });
}
