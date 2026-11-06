"use client";

import { supabaseBrowser } from "@/lib/supabase/browser";
import { MAX_UPLOAD_BYTES, STAGING_BUCKET, isAcceptedType, type ProcessedImage } from "./constants";

/*
  Browser side of a photo upload (AGENTS.md §4):
  1. ask the server for a one-file upload address, 2. send the file straight to Storage (phone photos are too big
  for a server request), 3. ask the server to process it. Returns the processed photo or a short message to show.
*/

export class UploadError extends Error {}

function looksAcceptable(file: File): string | null {
  const name = file.name.toLowerCase();
  const byName = /\.(jpe?g|png|webp|heic|heif)$/.test(name);
  // iPhones sometimes hand over HEIC with an empty type.
  const byType = file.type ? isAcceptedType(file.type) : byName;
  if (!byType && !byName) return "Use a JPG, PNG, WEBP or HEIC photo.";
  if (file.size > MAX_UPLOAD_BYTES) return "This photo is larger than 25 MB. Choose a smaller one.";
  if (file.size === 0) return "This file is empty.";
  return null;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new UploadError("No connection. Check your network and try again.");
  }
  const data = (await response.json().catch(() => null)) as ({ ok: true } & T) | { ok: false; error?: string } | null;
  if (!response.ok || !data || data.ok !== true) {
    throw new UploadError((data && "error" in data && data.error) || "The upload failed. Please try again.");
  }
  return data as T;
}

export async function uploadPhoto(file: File): Promise<ProcessedImage> {
  const problem = looksAcceptable(file);
  if (problem) throw new UploadError(problem);

  const signed = await postJson<{ path: string; token: string }>("/api/uploads/sign", { contentType: file.type, size: file.size });
  const { error } = await supabaseBrowser().storage.from(STAGING_BUCKET).uploadToSignedUrl(signed.path, signed.token, file, {
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw new UploadError("The upload did not finish. Check your network and try again.");

  const processed = await postJson<{ image: ProcessedImage }>("/api/images/process", { path: signed.path });
  return processed.image;
}
