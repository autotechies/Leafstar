import "server-only";
import sharp from "sharp";

/*
  A photo a visitor attached to a chat message (AGENTS.md §11, Step 14). One photo, JPG/PNG/WEBP, up to 5 MB.
  It is opened here no matter what the browser said, shrunk, and re-saved as a plain JPEG: that drops the location and
  camera details hidden in the file (EXIF) and means only a real image can reach the AI or the storage.
*/

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["jpeg", "png", "webp"]);

export type PreparedImage = { ok: true; data: Buffer } | { ok: false; error: string };

export async function prepareChatImage(base64: string): Promise<PreparedImage> {
  const raw = base64.replace(/^data:[^;]+;base64,/, "");
  if (!/^[A-Za-z0-9+/=\s]+$/.test(raw)) return { ok: false, error: "That photo could not be read. Please send a JPG, PNG or WEBP picture." };
  const input = Buffer.from(raw, "base64");
  if (input.length === 0) return { ok: false, error: "That photo is empty. Please try another." };
  if (input.length > MAX_IMAGE_BYTES) return { ok: false, error: "That photo is too big. Please send one under 5 MB." };
  try {
    const meta = await sharp(input, { limitInputPixels: 80_000_000, failOn: "error" }).metadata();
    if (!meta.format || !ALLOWED.has(meta.format)) return { ok: false, error: "Please send a JPG, PNG or WEBP picture." };
    const data = await sharp(input, { limitInputPixels: 80_000_000, failOn: "error" })
      .rotate()
      .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 82 })
      .toBuffer();
    return { ok: true, data };
  } catch {
    return { ok: false, error: "That photo could not be opened. Please try another one." };
  }
}
