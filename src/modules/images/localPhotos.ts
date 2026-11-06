"use client";

import type { Photo } from "./types";

/*
  Image lab only: turns a photo from the visitor's own phone into thumb / medium / large versions INSIDE the browser,
  so the viewer can be judged on real phone photos without any server. Nothing is uploaded.
  (The real pipeline, with HEIC support and metadata stripping, runs on the server: src/modules/images/process.ts.)
*/

async function render(bitmap: ImageBitmap, longSide: number): Promise<{ url: string; width: number; height: number }> {
  const scale = Math.min(1, longSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot resize photos.");
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  const finalBlob = blob && blob.type === "image/webp" ? blob : await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!finalBlob) throw new Error("This photo could not be resized.");
  return { url: URL.createObjectURL(finalBlob), width, height };
}

export async function photoFromFile(file: File, index: number): Promise<Photo> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const [thumb, medium, large] = await Promise.all([render(bitmap, 320 * (bitmap.height / bitmap.width > 1 ? bitmap.height / bitmap.width : 1)), render(bitmap, 1000), render(bitmap, 2000)]);
    return {
      id: `local-${Date.now()}-${index}`,
      thumbUrl: thumb.url,
      mediumUrl: medium.url,
      url: large.url,
      width: large.width,
      height: large.height,
      alt: `Your photo ${index + 1}`,
    };
  } finally {
    bitmap.close();
  }
}
