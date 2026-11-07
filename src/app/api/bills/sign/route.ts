import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiStaff, isSameOrigin, jsonError } from "@/lib/api";
import { rateLimitAllow } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkBillFile } from "@/modules/bills/formats";
import { BILLS_BUCKET } from "@/modules/bills/process";

/* Hands the browser a one-file upload address into the private bills bucket (bill photos and PDFs are bigger than a request may carry). */

const body = z.object({ name: z.string().min(1).max(200), type: z.string().max(100), size: z.number().int().positive(), batch: z.uuid() });

export async function POST(request: Request) {
  if (!(await isSameOrigin(request))) return jsonError("Request refused.", 403);
  const staff = await apiStaff();
  if (!staff) return jsonError("Please sign in again.", 401);
  if (!(await rateLimitAllow(`bill-sign:${staff.id}`, 600, 600))) return jsonError("Too many files at once. Wait a minute and try again.", 429);

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Request not understood.", 400);
  const { name, type, size, batch } = parsed.data;
  const check = checkBillFile(name, type, size);
  if (!check.ok) return jsonError(check.error ?? "This file cannot be used.", 415);

  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "bin";
  const path = `${staff.id}/${batch}/${randomUUID()}.${ext}`;
  const { data, error } = await supabaseAdmin().storage.from(BILLS_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[bills/sign]", error);
    return jsonError("Could not start the upload. Try again.", 500);
  }
  return NextResponse.json({ ok: true, path: data.path, token: data.token });
}
