import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiStaff, isSameOrigin, jsonError } from "@/lib/api";
import { rateLimitAllow } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { IMAGE_BUCKET, MAX_UPLOAD_BYTES, STAGING_BUCKET, type ProcessedImage } from "@/modules/images/constants";
import { UnreadableImageError, processImage } from "@/modules/images/process";

/*
  Step 2 of a photo upload: reads the raw file from private staging, makes thumb / medium / large WebP
  and a blur placeholder, stores them under a random folder, records them, then deletes the raw file.
  One photo per request, so it stays within a function's time limit.
*/

export const maxDuration = 60;

const body = z.object({ path: z.string().min(10).max(200) });

export async function POST(request: Request) {
  if (!(await isSameOrigin(request))) return jsonError("Request refused.", 403);
  const staff = await apiStaff();
  if (!staff) return jsonError("Please sign in again.", 401);
  if (!(await rateLimitAllow(`image-process:${staff.id}`, 120, 600))) {
    return jsonError("Too many photos at once. Wait a minute and try again.", 429);
  }

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Request not understood.", 400);
  const { path } = parsed.data;
  // A person may only process files they uploaded themselves.
  if (!path.startsWith(`${staff.id}/`) || path.includes("..")) return jsonError("Request refused.", 403);

  const admin = supabaseAdmin();
  const staging = admin.storage.from(STAGING_BUCKET);
  const discard = () => staging.remove([path]).catch(() => undefined);

  const download = await staging.download(path);
  if (download.error || !download.data) return jsonError("The upload did not arrive. Please try the photo again.", 404);
  if (download.data.size > MAX_UPLOAD_BYTES) {
    await discard();
    return jsonError("This photo is larger than 25 MB. Choose a smaller one.", 413);
  }

  let result;
  try {
    result = await processImage(Buffer.from(await download.data.arrayBuffer()));
  } catch (error) {
    await discard();
    if (error instanceof UnreadableImageError) return jsonError(error.message, 422);
    console.error("[images/process]", error);
    return jsonError("This photo could not be processed. Try another one.", 500);
  }

  const folder = randomBytes(16).toString("hex");
  const files = [
    ["thumb.webp", result.thumb],
    ["medium.webp", result.medium],
    ["large.webp", result.large],
  ] as const;
  const bucket = admin.storage.from(IMAGE_BUCKET);
  for (const [name, data] of files) {
    const { error } = await bucket.upload(`${folder}/${name}`, data, {
      contentType: "image/webp",
      cacheControl: "31536000", // names are random and never reused, so browsers may keep them for a year
      upsert: false,
    });
    if (error) {
      console.error("[images/process] upload", error);
      await bucket.remove(files.map(([n]) => `${folder}/${n}`));
      await discard();
      return jsonError("The photo could not be saved. Try again.", 500);
    }
  }

  const { error: recordError } = await admin.from("image_uploads").insert({
    folder,
    width: result.width,
    height: result.height,
    blur_data_url: result.blurDataUrl,
    uploaded_by: staff.id,
  });
  if (recordError) {
    console.error("[images/process] record", recordError);
    await bucket.remove(files.map(([n]) => `${folder}/${n}`));
    await discard();
    return jsonError("The photo could not be saved. Try again.", 500);
  }
  await discard();

  const url = (name: string) => bucket.getPublicUrl(`${folder}/${name}`).data.publicUrl;
  const image: ProcessedImage = {
    folder,
    thumbUrl: url("thumb.webp"),
    mediumUrl: url("medium.webp"),
    url: url("large.webp"),
    blurDataUrl: result.blurDataUrl,
    width: result.width,
    height: result.height,
  };
  return NextResponse.json({ ok: true, image });
}
