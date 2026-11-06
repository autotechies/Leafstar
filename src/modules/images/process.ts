import "server-only";
import sharp from "sharp";
import convert from "heic-convert";
import { MAX_INPUT_PIXELS, SIZES } from "./constants";

/*
  Turns one uploaded photo into the three sizes the site uses, plus a tiny blurred placeholder.
  - HEIC/HEIF (iPhone) is converted to JPEG first: the prebuilt sharp cannot read HEIC.
  - Rotation comes from the photo's EXIF, then ALL metadata (including GPS location) is dropped.
  - Output is WebP. The large version is capped at 2000px on its long side and is never enlarged.
*/

export class UnreadableImageError extends Error {
  constructor(message = "This file could not be read as a photo.") {
    super(message);
    this.name = "UnreadableImageError";
  }
}

export interface ProcessedBuffers {
  thumb: Buffer;
  medium: Buffer;
  large: Buffer;
  blurDataUrl: string;
  width: number;
  height: number;
}

/** HEIC/HEIF files carry "ftyp" followed by a brand such as heic, heix, mif1, msf1. */
export function looksLikeHeic(input: Buffer): boolean {
  if (input.length < 16) return false;
  if (input.toString("ascii", 4, 8) !== "ftyp") return false;
  const brand = input.toString("ascii", 8, 12);
  return ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand);
}

async function toDecodable(input: Buffer): Promise<Buffer> {
  if (!looksLikeHeic(input)) return input;
  try {
    const jpeg = await convert({ buffer: input, format: "JPEG", quality: 0.92 });
    return Buffer.from(jpeg);
  } catch {
    throw new UnreadableImageError("This iPhone photo could not be converted. Try sharing it as JPEG.");
  }
}

export async function processImage(raw: Buffer): Promise<ProcessedBuffers> {
  const input = await toDecodable(raw);
  const open = () => sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).rotate(); // rotate() applies EXIF orientation

  let oriented: { data: Buffer; info: { width: number; height: number } };
  try {
    // One decode for the master; the smaller sizes are made from it, which is faster and keeps them consistent.
    oriented = await open()
      .resize({ width: SIZES.large.long, height: SIZES.large.long, fit: "inside", withoutEnlargement: true })
      .webp({ quality: SIZES.large.quality, effort: 4 })
      .toBuffer({ resolveWithObject: true });
  } catch (error) {
    if (error instanceof Error && /pixel|exceeds/i.test(error.message)) {
      throw new UnreadableImageError("This photo is too large to process. Use a smaller resolution.");
    }
    throw new UnreadableImageError();
  }

  const { width, height } = oriented.info;
  if (!width || !height) throw new UnreadableImageError();

  const fromMaster = () => sharp(oriented.data);
  const [thumb, medium, blur] = await Promise.all([
    fromMaster().resize({ width: SIZES.thumb.width, withoutEnlargement: true }).webp({ quality: SIZES.thumb.quality }).toBuffer(),
    fromMaster().resize({ width: SIZES.medium.width, withoutEnlargement: true }).webp({ quality: SIZES.medium.quality }).toBuffer(),
    fromMaster().resize({ width: 16 }).blur(1).webp({ quality: 40 }).toBuffer(),
  ]);

  return {
    thumb,
    medium,
    large: oriented.data,
    blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
    width,
    height,
  };
}
