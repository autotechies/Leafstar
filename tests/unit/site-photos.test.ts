import { existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { photos } from "@/modules/site/photos";

describe("public site photos", () => {
  for (const [slot, p] of Object.entries(photos)) {
    it(`${slot}: the file exists, matches its stated size and has a description`, async () => {
      const file = join(process.cwd(), "public", p.src);
      expect(existsSync(file)).toBe(true);
      const meta = await sharp(file).metadata();
      expect([meta.width, meta.height]).toEqual([p.width, p.height]);
      expect(p.alt.length).toBeGreaterThan(10);
      expect(p.standIn ? p.note.length : 1).toBeGreaterThan(10);
    });
  }
});
