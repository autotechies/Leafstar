/*
  Turns the owner's original photos into the small, web-ready pictures the public site uses (AGENTS.md §9).
  Run:  node scripts/prepare-site-photos.mjs <folder with the original photos>

  Each slot below says which original it comes from, how to crop it, and what size to save.
  Crops are in pixels of the ORIGINAL (left, top, width, height) and are chosen so no printed text,
  other company's name or packing-box wording ends up on the site. To swap in a new photo, change the
  file name for that slot (or drop the new file in the folder under the same name) and run this again.
  Output: public/site/<slot>.webp. The list of what is a stand-in lives in src/modules/site/photos.ts.
*/
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = process.argv[2];
if (!src) {
  console.error("Usage: node scripts/prepare-site-photos.mjs <folder with the original photos>");
  process.exit(1);
}
const out = join(root, "public", "site");
mkdirSync(out, { recursive: true });

const slots = {
  // woman at a sewing machine, 4:5 portrait
  hero: { file: "4cc16b02-image.jpg", crop: { left: 430, top: 0, width: 1374, height: 1717 }, size: [1000, 1250] },
  // striped shirt on a model, 4:5 (a small logo on the pocket is in the original: replace with a Leaf Star shirt photo)
  shirts: { file: "110d200d-image.jpg", crop: { left: 0, top: 150, width: 1024, height: 1280 }, size: [900, 1125] },
  // jeans from the denim poster, cropped below its headline and clear of its side captions
  pants: { file: "478e7c23-image.jpg", crop: { left: 0, top: 250, width: 800, height: 1000 }, size: [900, 1125] },
  // whole factory floor, 16:9
  factory: { file: "d161420b-image.jpg", crop: { left: 0, top: 0, width: 2576, height: 1449 }, size: [1600, 900] },
  // three workers rolling fabric, 16:9
  team: { file: "09454bba-image.jpg", crop: { left: 0, top: 200, width: 2576, height: 1449 }, size: [1600, 900] },
  // rows of embroidery machines, square
  machinery: { file: "f265eb43-image.jpg", crop: { left: 600, top: 0, width: 1450, height: 1450 }, size: [900, 900] },
  // hands marking fabric before cutting, 4:3
  cutting: { file: "2873059c-image.jpg", crop: { left: 0, top: 600, width: 1717, height: 1288 }, size: [1200, 900] },
  // second view of a machinist at work (wide), 16:9, for the About page
  stitching: { file: "4cc16b02-image.jpg", crop: { left: 0, top: 134, width: 2576, height: 1449 }, size: [1600, 900] },
};

for (const [slot, s] of Object.entries(slots)) {
  const file = join(out, `${slot}.webp`);
  const info = await sharp(join(src, s.file)).extract(s.crop).resize(s.size[0], s.size[1], { fit: "cover" }).webp({ quality: 80, effort: 5 }).toFile(file);
  console.log(`${slot.padEnd(10)} ${info.width}x${info.height}  ${Math.round(info.size / 1024)} KB`);
}
