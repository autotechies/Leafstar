#!/usr/bin/env node
/*
  Makes the four TEST PATTERN images used by /dev/image-lab (public/dev/lab/). They are plainly not product photos:
  numbered grids with fine print, so you can see at a glance whether zooming stays sharp and whether panning is smooth.
  Sizes mirror src/modules/images/constants.ts (thumb 320, medium 800, large 2000 long side).
  Run once: node scripts/make-lab-samples.mjs   (output is committed)
*/
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";

const out = new URL("../public/dev/lab/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const palettes = [
  { name: "Navy", a: "#16294a", b: "#2f5597", ink: "#f4ead2" },
  { name: "Olive", a: "#3c4a22", b: "#7a8b45", ink: "#f6f1de" },
  { name: "Maroon", a: "#4a1620", b: "#9a3a4a", ink: "#f8e9e3" },
  { name: "Charcoal", a: "#22262b", b: "#59626d", ink: "#eef0f2" },
];

function pattern(p, n) {
  const w = 1600, h = 2000;
  let grid = "";
  for (let x = 0; x <= w; x += 100) grid += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${p.ink}" stroke-opacity="${x % 400 === 0 ? 0.55 : 0.18}" stroke-width="${x % 400 === 0 ? 3 : 1}"/>`;
  for (let y = 0; y <= h; y += 100) grid += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${p.ink}" stroke-opacity="${y % 400 === 0 ? 0.55 : 0.18}" stroke-width="${y % 400 === 0 ? 3 : 1}"/>`;
  let fine = "";
  for (let row = 0; row < 24; row++) {
    fine += `<text x="120" y="${1180 + row * 26}" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="${p.ink}" fill-opacity="0.85">Fine print line ${row + 1}: zoom in until this is easy to read. The quick brown fox jumps over the lazy dog 0123456789</text>`;
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.a}"/><stop offset="1" stop-color="${p.b}"/></linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>${grid}
    <circle cx="800" cy="520" r="300" fill="none" stroke="${p.ink}" stroke-width="6"/>
    <circle cx="800" cy="520" r="200" fill="none" stroke="${p.ink}" stroke-width="3"/>
    <circle cx="800" cy="520" r="100" fill="none" stroke="${p.ink}" stroke-width="2"/>
    <text x="800" y="580" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-weight="700" font-size="220" fill="${p.ink}">${n}</text>
    <text x="800" y="1020" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="64" fill="${p.ink}">TEST PATTERN · ${p.name.toUpperCase()}</text>
    <text x="800" y="1100" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="30" fill="${p.ink}" fill-opacity="0.9">Not a product photo. Used to check zoom and pan.</text>
    ${fine}</svg>`);
}

const meta = [];
for (const [i, p] of palettes.entries()) {
  const n = i + 1;
  const master = await sharp(pattern(p, n)).webp({ quality: 84 }).toBuffer();
  const thumb = await sharp(master).resize({ width: 320 }).webp({ quality: 78 }).toBuffer();
  const medium = await sharp(master).resize({ width: 800 }).webp({ quality: 80 }).toBuffer();
  const blur = await sharp(master).resize({ width: 16 }).blur(1).webp({ quality: 40 }).toBuffer();
  writeFileSync(`${out}pattern-${n}-thumb.webp`, thumb);
  writeFileSync(`${out}pattern-${n}-medium.webp`, medium);
  writeFileSync(`${out}pattern-${n}-large.webp`, master);
  meta.push({ n, name: p.name, hex: p.a, width: 1600, height: 2000, blur: `data:image/webp;base64,${blur.toString("base64")}` });
}
writeFileSync(`${out}samples.json`, JSON.stringify(meta, null, 2));
console.log("wrote", meta.length, "patterns to public/dev/lab/");
