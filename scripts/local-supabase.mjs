#!/usr/bin/env node
/*
  A local stand-in for a Supabase project, built from the REAL Supabase parts, for end-to-end tests:
    - Postgres (yours: DATABASE_URL must point at a server where we may create databases)
    - Supabase Auth (the "GoTrue" server, official release binary)  → login, password reset, two-step login
    - PostgREST (official release binary)                            → the database API supabase-js talks to
    - a tiny gateway on one port that routes /auth/v1 and /rest/v1 like Supabase does
  It builds a fresh database every run: Supabase roles → the auth server's own migrations →
  supabase/schema.sql → every numbered migration, exactly the owner's order.
  Storage, Realtime and email delivery are NOT part of it; tests that need them say so.

  Never point this at a real Supabase project. Keys and passwords here are local-only and public.

  CLI:   DATABASE_URL=postgresql://postgres@localhost:5432/postgres node scripts/local-supabase.mjs
  Code:  import { startLocalSupabase, LOCAL_SUPABASE } from "./local-supabase.mjs"
*/
import { spawn, execFileSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import http from "node:http";
import { join } from "node:path";
import pg from "pg";

const root = new URL("..", import.meta.url).pathname;
const cacheDir = join(root, ".cache", "local-supabase");

const AUTH_VERSION = "v2.186.0";
const POSTGREST_VERSION = "v12.2.3";
const JWT_SECRET = "local-only-jwt-secret-at-least-32-characters-long";
const ROLE_PASSWORD = "local-only"; // set for authenticator and supabase_auth_admin in tests/local-supabase/init.sql

export const LOCAL_SUPABASE = {
  port: 54321,
  url: "http://127.0.0.1:54321",
  authPort: 54329,
  restPort: 54328,
  anonKey: sign({ role: "anon" }),
  serviceKey: sign({ role: "service_role" }),
  owner: { email: "owner@leafstar.test", password: "Local-owner-pass-123", name: "Test Owner" },
};

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}
function sign(claims) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  // Fixed issue time so the keys are identical on every run (they are baked into the test build).
  const body = b64url(JSON.stringify({ iss: "supabase-local", iat: 1767225600, exp: 2082758400, ...claims }));
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

async function download(url, file) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

/** Fetches the two official binaries once into .cache/local-supabase (git-ignored). */
export async function ensureBinaries() {
  mkdirSync(cacheDir, { recursive: true });
  const authDir = join(cacheDir, `auth-${AUTH_VERSION}`);
  if (!existsSync(join(authDir, "auth"))) {
    const tgz = join(cacheDir, "auth.tgz");
    await download(`https://github.com/supabase/auth/releases/download/${AUTH_VERSION}/auth-${AUTH_VERSION}-x86.tar.gz`, tgz);
    mkdirSync(authDir, { recursive: true });
    execFileSync("tar", ["xzf", tgz, "-C", authDir]);
    rmSync(tgz);
  }
  const restBin = join(cacheDir, `postgrest-${POSTGREST_VERSION}`);
  if (!existsSync(restBin)) {
    const txz = join(cacheDir, "postgrest.tar.xz");
    await download(`https://github.com/PostgREST/postgrest/releases/download/${POSTGREST_VERSION}/postgrest-${POSTGREST_VERSION}-linux-static-x64.tar.xz`, txz);
    execFileSync("tar", ["xJf", txz, "-C", cacheDir]);
    execFileSync("mv", [join(cacheDir, "postgrest"), restBin]);
    chmodSync(restBin, 0o755);
    rmSync(txz);
  }
  return { authDir, authBin: join(authDir, "auth"), restBin };
}

function withDb(url, dbName, user, password) {
  const u = new URL(url);
  u.pathname = `/${dbName}`;
  if (user) {
    u.username = user;
    u.password = password ?? "";
  }
  return u.toString();
}

async function waitFor(url, name, ms = 30_000) {
  const until = Date.now() + ms;
  let last;
  while (Date.now() < until) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
      last = `HTTP ${res.status}`;
    } catch (e) {
      last = e.message;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${name} did not start: ${last}`);
}

function run(bin, args, env, label) {
  const child = spawn(bin, args, { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  const log = [];
  const keep = (d) => {
    log.push(d.toString());
    if (log.length > 200) log.shift();
  };
  child.stdout.on("data", keep);
  child.stderr.on("data", keep);
  child.on("exit", (code) => {
    if (code && !child.killedOnPurpose) console.error(`[local-supabase] ${label} exited with ${code}\n${log.join("")}`);
  });
  return child;
}

function gateway() {
  const routes = [
    ["/auth/v1", LOCAL_SUPABASE.authPort],
    ["/rest/v1", LOCAL_SUPABASE.restPort],
  ];
  const server = http.createServer((req, res) => {
    const match = routes.find(([prefix]) => req.url === prefix || req.url.startsWith(`${prefix}/`) || req.url.startsWith(`${prefix}?`));
    if (!match) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "Not part of the local test stack (storage and realtime are not included)" }));
      return;
    }
    const [prefix, port] = match;
    const upstream = http.request(
      { host: "127.0.0.1", port, path: req.url.slice(prefix.length) || "/", method: req.method, headers: { ...req.headers, host: `127.0.0.1:${port}` } },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", (e) => {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: e.message }));
    });
    req.pipe(upstream);
  });
  return new Promise((resolve) => server.listen(LOCAL_SUPABASE.port, "127.0.0.1", () => resolve(server)));
}

/**
 * Starts the stack on a brand-new database and creates the owner (bootstrap_owner, as in Step 0).
 * Returns the connection details and a stop() that removes everything again.
 */
export async function startLocalSupabase({ databaseUrl = process.env.DATABASE_URL, siteUrl = "http://127.0.0.1:3100" } = {}) {
  if (!databaseUrl) throw new Error("DATABASE_URL is not set (a Postgres server where databases may be created)");
  const { authDir, authBin, restBin } = await ensureBinaries();
  const dbName = `ls_e2e_${randomBytes(4).toString("hex")}`;

  const server = new pg.Client({ connectionString: databaseUrl });
  await server.connect();
  await server.query(`create database ${dbName}`);
  await server.end();

  const admin = new pg.Client({ connectionString: withDb(databaseUrl, dbName) });
  await admin.connect();
  admin.on("notice", () => undefined);
  await admin.query(readFileSync(join(root, "tests", "local-supabase", "init.sql"), "utf8"));

  const authEnv = {
    GOTRUE_DB_DRIVER: "postgres",
    DATABASE_URL: withDb(databaseUrl, dbName, "supabase_auth_admin", ROLE_PASSWORD),
    GOTRUE_DB_MIGRATIONS_PATH: join(authDir, "migrations"),
    API_EXTERNAL_URL: `${LOCAL_SUPABASE.url}/auth/v1`,
    GOTRUE_API_HOST: "127.0.0.1",
    PORT: String(LOCAL_SUPABASE.authPort),
    GOTRUE_SITE_URL: siteUrl,
    GOTRUE_URI_ALLOW_LIST: `${siteUrl}/**`,
    GOTRUE_JWT_SECRET: JWT_SECRET,
    GOTRUE_JWT_EXP: "3600",
    GOTRUE_JWT_AUD: "authenticated",
    GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated",
    GOTRUE_JWT_ADMIN_ROLES: "service_role",
    GOTRUE_DISABLE_SIGNUP: "true",
    GOTRUE_EXTERNAL_EMAIL_ENABLED: "true",
    GOTRUE_MAILER_AUTOCONFIRM: "true",
    GOTRUE_PASSWORD_MIN_LENGTH: "12",
    GOTRUE_MFA_TOTP_ENROLL_ENABLED: "true",
    GOTRUE_MFA_TOTP_VERIFY_ENABLED: "true",
    // Generous limits so the test run itself is never rate limited.
    GOTRUE_RATE_LIMIT_EMAIL_SENT: "1000",
    GOTRUE_RATE_LIMIT_TOKEN_REFRESH: "1000",
    GOTRUE_RATE_LIMIT_VERIFY: "1000",
    GOTRUE_RATE_LIMIT_OTP: "1000",
    GOTRUE_LOG_LEVEL: "warn",
  };
  execFileSync(authBin, ["migrate"], { env: { ...process.env, ...authEnv }, stdio: "pipe" });

  const supabaseDir = join(root, "supabase");
  const files = ["schema.sql", ...readdirSync(supabaseDir).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort()];
  for (const f of files) {
    try {
      await admin.query(readFileSync(join(supabaseDir, f), "utf8"));
    } catch (e) {
      throw new Error(`Applying ${f} failed: ${e.message}`);
    }
  }

  const auth = run(authBin, ["serve"], authEnv, "auth server");
  const rest = run(
    restBin,
    [],
    {
      PGRST_DB_URI: withDb(databaseUrl, dbName, "authenticator", ROLE_PASSWORD),
      PGRST_DB_SCHEMAS: "public",
      PGRST_DB_ANON_ROLE: "anon",
      PGRST_JWT_SECRET: JWT_SECRET,
      PGRST_SERVER_HOST: "127.0.0.1",
      PGRST_SERVER_PORT: String(LOCAL_SUPABASE.restPort),
      PGRST_LOG_LEVEL: "warn",
    },
    "PostgREST",
  );
  const gw = await gateway();
  await waitFor(`http://127.0.0.1:${LOCAL_SUPABASE.authPort}/health`, "auth server");
  await waitFor(`http://127.0.0.1:${LOCAL_SUPABASE.restPort}/`, "PostgREST");

  // The owner, created the way Step 0 does it: an auth user, then bootstrap_owner().
  const { email, password, name } = LOCAL_SUPABASE.owner;
  const res = await fetch(`${LOCAL_SUPABASE.url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${LOCAL_SUPABASE.serviceKey}`, apikey: LOCAL_SUPABASE.serviceKey },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`Creating the test owner failed: ${res.status} ${await res.text()}`);
  await admin.query(`select bootstrap_owner($1, $2)`, [email, name]);

  return {
    ...LOCAL_SUPABASE,
    dbName,
    /** Superuser connection to the test database (setup and checks). */
    admin,
    async stop() {
      for (const child of [auth, rest]) {
        child.killedOnPurpose = true;
        child.kill("SIGTERM");
      }
      await new Promise((r) => gw.close(() => r()));
      await admin.end();
      const s = new pg.Client({ connectionString: databaseUrl });
      await s.connect();
      await s.query(`drop database if exists ${dbName} with (force)`);
      await s.end();
    },
  };
}

// CLI: start, print the details, keep running until Ctrl+C.
if (import.meta.url === `file://${process.argv[1]}`) {
  const stack = await startLocalSupabase();
  console.log(`Local Supabase running at ${stack.url}
  NEXT_PUBLIC_SUPABASE_URL=${stack.url}
  NEXT_PUBLIC_SUPABASE_ANON_KEY=${stack.anonKey}
  SUPABASE_SERVICE_ROLE_KEY=${stack.serviceKey}
  owner: ${stack.owner.email} / <redacted>
Press Ctrl+C to stop.`);
  const stop = async () => {
    await stack.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
