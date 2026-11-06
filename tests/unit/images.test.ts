import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { UnreadableImageError, looksLikeHeic, processImage } from "@/modules/images/process";
import { isAcceptedType } from "@/modules/images/constants";

async function jpeg(width: number, height: number, options: { orientation?: number; exif?: import("sharp").Exif } = {}) {
  let image = sharp({ create: { width, height, channels: 3, background: { r: 30, g: 60, b: 120 } } });
  // A red block in the top-left corner shows which way the picture ended up.
  image = image.composite([{ input: { create: { width: 200, height: 100, channels: 3, background: { r: 220, g: 30, b: 30 } } }, left: 0, top: 0 }]);
  if (options.exif) image = image.withExif(options.exif);
  if (options.orientation) image = image.withMetadata({ orientation: options.orientation });
  return image.jpeg().toBuffer();
}

describe("processImage", () => {
  it("makes three WebP sizes and a blur placeholder, capped at 2000px, never enlarged", async () => {
    const out = await processImage(await jpeg(3000, 4000));
    const large = await sharp(out.large).metadata();
    expect(large.format).toBe("webp");
    expect(Math.max(large.width!, large.height!)).toBe(2000);
    expect((await sharp(out.medium).metadata()).width).toBe(800);
    expect((await sharp(out.thumb).metadata()).width).toBe(320);
    expect(out.width).toBe(large.width);
    expect(out.height).toBe(large.height);
    expect(out.blurDataUrl.startsWith("data:image/webp;base64,")).toBe(true);
    expect(out.blurDataUrl.length).toBeLessThan(2500);

    const small = await processImage(await jpeg(500, 600));
    expect((await sharp(small.large).metadata()).width).toBe(500);
    expect((await sharp(small.medium).metadata()).width).toBe(500);
    expect((await sharp(small.thumb).metadata()).width).toBe(320);
  });

  it("turns a sideways phone photo upright using its EXIF orientation", async () => {
    // Stored landscape 3000x2000 with orientation 6 = shown rotated, so it should come out portrait.
    const out = await processImage(await jpeg(3000, 2000, { orientation: 6 }));
    expect(out.height).toBeGreaterThan(out.width);
    expect(out.width).toBe(1333);
    expect(out.height).toBe(2000);
  });

  it("removes location and every other piece of metadata", async () => {
    const withGps = await jpeg(1200, 800, {
      exif: {
        IFD0: { Make: "TestPhone" },
        IFD3: { GPSLatitudeRef: "N", GPSLatitude: "12/1 58/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "77/1 35/1 0/1" },
      },
    });
    expect((await sharp(withGps).metadata()).exif).toBeDefined(); // the test photo really has metadata
    const out = await processImage(withGps);
    for (const buffer of [out.thumb, out.medium, out.large]) {
      const meta = await sharp(buffer).metadata();
      expect(meta.exif).toBeUndefined();
      expect(meta.icc).toBeUndefined();
      expect(buffer.includes(Buffer.from("TestPhone"))).toBe(false);
    }
  });

  it("converts an iPhone HEIC photo", async () => {
    const heic = readFileSync(join(__dirname, "..", "fixtures", "iphone-orientation6.heic"));
    expect(looksLikeHeic(heic)).toBe(true);
    const out = await processImage(heic);
    const meta = await sharp(out.large).metadata();
    expect(meta.format).toBe("webp");
    expect(out.width).toBeGreaterThan(0);
    expect(out.height).toBeGreaterThan(0);
  });

  it("refuses files that are not photos, with a friendly error", async () => {
    await expect(processImage(Buffer.from("this is not an image at all, just text"))).rejects.toBeInstanceOf(UnreadableImageError);
    await expect(processImage(Buffer.alloc(0))).rejects.toBeInstanceOf(UnreadableImageError);
  });

  it("refuses a corrupt HEIC without crashing", async () => {
    const fake = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic"), Buffer.alloc(64, 7)]);
    expect(looksLikeHeic(fake)).toBe(true);
    await expect(processImage(fake)).rejects.toBeInstanceOf(UnreadableImageError);
  });

  it("refuses an absurdly large picture (decompression bomb) before decoding it", async () => {
    // 12000 x 9000 = 108 megapixels of a single colour: tiny file, huge when opened.
    const bomb = await sharp({ create: { width: 12000, height: 9000, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png({ compressionLevel: 9 }).toBuffer();
    expect(bomb.length).toBeLessThan(5 * 1024 * 1024);
    await expect(processImage(bomb)).rejects.toBeInstanceOf(UnreadableImageError);
  }, 60_000);
});

describe("upload rules", () => {
  it("accepts phone photo types only", () => {
    for (const ok of ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "IMAGE/JPEG"]) expect(isAcceptedType(ok)).toBe(true);
    for (const bad of ["image/gif", "image/svg+xml", "application/pdf", "text/html", ""]) expect(isAcceptedType(bad)).toBe(false);
  });

  it("recognises HEIC by content, not by name", () => {
    expect(looksLikeHeic(Buffer.from("not heic at all, plain text here"))).toBe(false);
    expect(looksLikeHeic(Buffer.alloc(4))).toBe(false);
  });
});
