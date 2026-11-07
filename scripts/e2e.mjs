#!/usr/bin/env node
/*
  End-to-end tests against the real Supabase Auth server and PostgREST (scripts/local-supabase.mjs):
    1. start the local Supabase stack on a fresh database (owner created as in Step 0),
    2. build the app pointed at it,
    3. start the app,
    4. run Playwright against it,
    5. stop everything and remove the database.
  Needs DATABASE_URL (a Postgres server where databases may be created). Without it, the browser tests
  that need a database are skipped and the rest (styleguide, screenshots) still run.
  Extra arguments go to Playwright, e.g.  node scripts/e2e.mjs tests/e2e/auth.spec.ts
*/
import { spawn, execFileSync } from "node:child_process";
import { join } from "node:path";
import { startLocalSupabase, LOCAL_SUPABASE } from "./local-supabase.mjs";

const root = new URL("..", import.meta.url).pathname;
const bin = (name) => join(root, "node_modules", ".bin", name);
const port = Number(process.env.PW_PORT ?? 3100);
const site = `http://127.0.0.1:${port}`;

/** On GitHub, a failure before the tests start also becomes an annotation on the check. */
function report(error) {
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=e2e setup::${String(error?.stack ?? error).replace(/\n/g, "%0A")}`);
}

let stack = null;
if (process.env.DATABASE_URL) {
  console.log("[e2e] starting local Supabase (Auth + PostgREST) on a fresh database…");
  try {
    stack = await startLocalSupabase({ siteUrl: site });
  } catch (error) {
    report(error);
    throw error;
  }
} else {
  console.log("[e2e] DATABASE_URL not set: database tests will be skipped.");
}

const appEnv = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_SITE_URL: site,
  // The test pages (/dev/*) are closed on a production server unless allowed; the tests use them.
  ALLOW_DEV_PAGES: "1",
  ...(stack
    ? {
        NEXT_PUBLIC_SUPABASE_URL: LOCAL_SUPABASE.url,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: LOCAL_SUPABASE.anonKey,
        SUPABASE_SERVICE_ROLE_KEY: LOCAL_SUPABASE.serviceKey,
      }
    : {}),
};

let server;
let code = 1;
try {
  if (!process.env.E2E_SKIP_BUILD) {
    console.log("[e2e] building the app against the local stack…");
    execFileSync(bin("next"), ["build"], { cwd: root, env: appEnv, stdio: "inherit" });
  }
  server = spawn(bin("next"), ["start", "-p", String(port), "-H", "127.0.0.1"], { cwd: root, env: appEnv, stdio: ["ignore", "pipe", "pipe"] });
  const serverLog = [];
  server.stdout.on("data", (d) => serverLog.push(d.toString()));
  server.stderr.on("data", (d) => serverLog.push(d.toString()));
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(site)).status < 500) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  code = await new Promise((resolve) => {
    const pw = spawn(bin("playwright"), ["test", ...process.argv.slice(2)], {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        PW_BASE_URL: site,
        ...(stack
          ? {
              LS_E2E_SUPABASE_URL: LOCAL_SUPABASE.url,
              LS_E2E_SERVICE_KEY: LOCAL_SUPABASE.serviceKey,
              LS_E2E_DB_URL: (() => {
                const u = new URL(process.env.DATABASE_URL);
                u.pathname = `/${stack.dbName}`;
                return u.toString();
              })(),
              LS_E2E_OWNER_EMAIL: LOCAL_SUPABASE.owner.email,
              LS_E2E_OWNER_PASSWORD: LOCAL_SUPABASE.owner.password,
            }
          : {}),
      },
    });
    pw.on("exit", (c) => resolve(c ?? 1));
  });
  if (code !== 0 && process.env.E2E_SHOW_SERVER_LOG) console.log(serverLog.join(""));
} finally {
  server?.kill("SIGTERM");
  await stack?.stop();
}
process.exit(code);
