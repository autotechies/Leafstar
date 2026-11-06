import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiStaff, isSameOrigin, jsonError } from "@/lib/api";
import { rateLimitAllow } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MAX_UPLOAD_BYTES, STAGING_BUCKET, isAcceptedType } from "@/modules/images/constants";

/*
  Step 1 of a photo upload: hands the browser a short-lived, single-file upload address.
  Phone photos are bigger than a server request may carry, so the file goes straight to Storage;
  /api/images/process then picks it up. Only signed-in staff may ask.
*/

const body = z.object({
  contentType: z.string().max(100),
  size: z.number().int().positive(),
});

export async function POST(request: Request) {
  if (!(await isSameOrigin(request))) return jsonError("Request refused.", 403);
  const staff = await apiStaff();
  if (!staff) return jsonError("Please sign in again.", 401);
  if (!(await rateLimitAllow(`upload-sign:${staff.id}`, 120, 600))) {
    return jsonError("Too many uploads at once. Wait a minute and try again.", 429);
  }

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Request not understood.", 400);
  const { contentType, size } = parsed.data;

  // Some browsers report HEIC as an empty type; the processor identifies the real format from the bytes.
  const type = contentType.toLowerCase();
  if (type && !isAcceptedType(type)) return jsonError("Use a JPG, PNG, WEBP or HEIC photo.", 415);
  if (size > MAX_UPLOAD_BYTES) return jsonError("This photo is larger than 25 MB. Choose a smaller one.", 413);

  const path = `${staff.id}/${randomUUID()}`;
  const { data, error } = await supabaseAdmin().storage.from(STAGING_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[uploads/sign]", error);
    return jsonError("Could not start the upload. Try again.", 500);
  }
  return NextResponse.json({ ok: true, path: data.path, token: data.token });
}
