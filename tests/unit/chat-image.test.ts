import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { prepareChatImage } from "@/modules/chat/image";

const make = (w: number, h: number, format: "jpeg" | "png" | "webp" = "jpeg") =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 30, b: 30 } } }).toFormat(format).withExif({ IFD0: { Copyright: "secret-owner" } }).toBuffer();

describe("prepareChatImage", () => {
  it("shrinks big photos to 1280px and returns a JPEG without EXIF", async () => {
    const out = await prepareChatImage((await make(3000, 2000)).toString("base64"));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const meta = await sharp(out.data).metadata();
    expect(meta.format).toBe("jpeg");
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(1280);
    expect(meta.exif).toBeUndefined();
  });
  it("accepts png and webp, and data URLs", async () => {
    for (const f of ["png", "webp"] as const) {
      const out = await prepareChatImage(`data:image/${f};base64,${(await make(200, 200, f)).toString("base64")}`);
      expect(out.ok).toBe(true);
    }
  });
  it("refuses non-images, empty and oversized input", async () => {
    expect((await prepareChatImage(Buffer.from("hello, not an image").toString("base64"))).ok).toBe(false);
    expect((await prepareChatImage("")).ok).toBe(false);
    expect((await prepareChatImage("!!!not base64!!!")).ok).toBe(false);
    expect((await prepareChatImage(Buffer.alloc(5 * 1024 * 1024 + 10, 1).toString("base64"))).ok).toBe(false);
  });
  it("refuses other image formats such as gif", async () => {
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: "red" } }).gif().toBuffer();
    expect((await prepareChatImage(gif.toString("base64"))).ok).toBe(false);
  });
});
