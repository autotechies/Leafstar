/* Shared by the browser and the server. */

export const STAGING_BUCKET = "image-staging";
export const IMAGE_BUCKET = "article-images";

/** What a phone or camera produces. HEIC/HEIF is what iPhones save by default. */
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;
export const ACCEPT_ATTRIBUTE = ".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif";

/** Phone photos are 3–12 MB; 25 MB leaves room for the biggest cameras. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
/** Refuse absurd dimensions before decoding (protects the server's memory). */
export const MAX_INPUT_PIXELS = 100_000_000;

export const SIZES = {
  thumb: { width: 320, quality: 78 },
  medium: { width: 800, quality: 80 },
  /** Long side. The large version is the master used for zoom. */
  large: { long: 2000, quality: 84 },
} as const;

export interface ProcessedImage {
  /** Random folder inside the article-images bucket. */
  folder: string;
  thumbUrl: string;
  mediumUrl: string;
  url: string;
  blurDataUrl: string;
  width: number;
  height: number;
}

export function isAcceptedType(type: string): boolean {
  return (ACCEPTED_TYPES as readonly string[]).includes(type.toLowerCase());
}
