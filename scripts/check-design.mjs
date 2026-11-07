#!/usr/bin/env node
/*
  Design rule check (DESIGN.md §10, AGENTS.md §3). Fails the build when component code uses:
  - raw colours (#hex, rgb(), hsl()) — colours must come from tokens;
  - Tailwind arbitrary values like mt-[13px], text-[15px], bg-[#fff] — sizes must come from the scales;
  - inline style={{…}} without a comment on the line above saying why (only data-driven values are allowed:
    a product's real colour, a bar's width, a countdown length).
  The token files themselves (globals.css, lib/tokens.ts) and generated types are exempt.
*/
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const srcDir = join(root, "src");
const exempt = new Set(["src/app/globals.css", "src/lib/tokens.ts", "src/types/database.ts", "src/app/layout.tsx", "src/app/manifest.ts"]);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const rules = [
  { name: "raw colour", re: /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/ },
  // a Tailwind class followed by [ … ] e.g. mt-[13px], bg-[#fff], text-[15px], grid-cols-[1fr_2fr]
  { name: "arbitrary Tailwind value", re: /(?:^|[\s"'`])[a-z][a-z0-9:-]*-\[[^\]]+\]/ },
];

const problems = [];
for (const file of walk(srcDir).filter((f) => /\.(tsx?|css)$/.test(f))) {
  const rel = relative(root, file);
  if (exempt.has(rel)) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, "");
    if (/^\s*(\*|\/\*)/.test(line)) return; // comment lines
    for (const r of rules) {
      if (r.re.test(code)) problems.push(`${rel}:${i + 1}  ${r.name}: ${line.trim()}`);
    }
    if (/style=\{\{/.test(code)) {
      const prev = lines.slice(Math.max(0, i - 2), i).join(" ");
      if (!/\/\/|\/\*/.test(prev)) problems.push(`${rel}:${i + 1}  inline style without a reason comment above it`);
    }
  });
}

// Sample data in the styleguide demos legitimately holds product colour hex codes.
const allowed = problems.filter((p) => !(p.startsWith("src/app/dev/styleguide/Demos.tsx") && p.includes("hex:")));

if (allowed.length) {
  console.error(`Design check failed (${allowed.length}):\n` + allowed.join("\n"));
  process.exit(1);
}
console.log("Design check passed: no raw colours, no off-scale values, no unexplained inline styles.");
