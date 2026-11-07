#!/usr/bin/env node
/*
  Builds the static GitHub Pages preview (AGENTS.md §2).
  1. Copies the project to a temporary folder.
  2. Removes every page and server route that is NOT listed in preview.routes.json,
     so nothing that needs a server (or a secret) can ever reach the public preview.
  3. Runs a static export with the repository's sub-folder as base path.
  4. Writes the result to ./preview-out (what GitHub Pages serves).
  Usage: LS_BASE_PATH=/leafstar node scripts/build-preview.mjs
*/
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { execFileSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const { routes } = JSON.parse(readFileSync(join(root, "preview.routes.json"), "utf8"));
const allowed = new Set(routes.map((r) => r.replace(/^\/|\/$/g, "")));

// Built inside the project (git-ignored) so the bundler can reach node_modules through the project root.
const work = join(root, ".preview-build");
rmSync(work, { recursive: true, force: true });
mkdirSync(work);
const skip = new Set(["node_modules", ".next", ".git", "out", "preview-out", ".preview-build", "screenshots", "test-results", "playwright-report"]);
for (const name of readdirSync(root)) {
  if (skip.has(name) || name.startsWith(".env")) continue;
  cpSync(join(root, name), join(work, name), { recursive: true });
}
symlinkSync(join(root, "node_modules"), join(work, "node_modules"), "dir");

// Keep only allowed routes. A folder is a route if it holds page.tsx or route.ts. Folders in (parentheses) are route
// groups: they are not part of the address, so "(site)/about" is the route "about".
const appDir = join(work, "src", "app");
const isGroup = (name) => /^\(.+\)$/.test(name);
const routeOf = (dir) => relative(appDir, dir).split(sep).filter((part) => part && !isGroup(part)).join("/");
function prune(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!isGroup(name)) {
        const route = routeOf(full);
        const keepsSomething = [...allowed].some((r) => r === route || r.startsWith(`${route}/`));
        if (!keepsSomething) {
          rmSync(full, { recursive: true, force: true });
          continue;
        }
      }
      prune(full);
    } else if (/^(page|route)\.tsx?$/.test(name) && !allowed.has(routeOf(dir))) {
      rmSync(full, { force: true });
    }
  }
}
prune(appDir);
// Files that read the database or describe the live site cannot be exported statically.
for (const f of ["sitemap.ts", "robots.ts", "manifest.ts"]) rmSync(join(appDir, f), { force: true });
for (const f of ["proxy.ts", join("src", "proxy.ts"), "middleware.ts", join("src", "middleware.ts")]) rmSync(join(work, f), { force: true });

const env = { ...process.env, LS_PREVIEW_EXPORT: "1", LS_TURBOPACK_ROOT: root, NEXT_TELEMETRY_DISABLED: "1" };
// Secrets never reach the preview build, even if present in the environment.
for (const k of Object.keys(env)) {
  if (!k.startsWith("NEXT_PUBLIC_") && /KEY|SECRET|TOKEN|PASSWORD/i.test(k)) delete env[k];
}

execFileSync(join(root, "node_modules", ".bin", "next"), ["build"], { cwd: work, env, stdio: "inherit" });

const out = join(root, "preview-out");
rmSync(out, { recursive: true, force: true });
cpSync(join(work, "out"), out, { recursive: true });
// GitHub Pages would otherwise hide the _next folder.
writeFileSync(join(out, ".nojekyll"), "");
rmSync(work, { recursive: true, force: true });

if (!existsSync(join(out, "index.html"))) throw new Error("Preview build produced no index.html");
console.log(`Preview ready in preview-out/ (base path: ${process.env.LS_BASE_PATH || "/"}) with routes: ${[...allowed].map((r) => "/" + r).join(", ")}`);
