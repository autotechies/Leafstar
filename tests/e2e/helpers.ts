import { createHmac } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import pg from "pg";

/* Helpers for tests that run against the local Supabase stack started by scripts/e2e.mjs. */

export const stack = {
  url: process.env.LS_E2E_SUPABASE_URL ?? "",
  serviceKey: process.env.LS_E2E_SERVICE_KEY ?? "",
  dbUrl: process.env.LS_E2E_DB_URL ?? "",
  email: process.env.LS_E2E_OWNER_EMAIL ?? "",
  password: process.env.LS_E2E_OWNER_PASSWORD ?? "",
};
export const hasStack = Boolean(stack.url && stack.dbUrl);

/** Runs SQL as the database superuser (to set up a situation or check the result directly). */
export async function sql<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: stack.dbUrl });
  await client.connect();
  try {
    return (await client.query<T>(text, params)).rows;
  } finally {
    await client.end();
  }
}

/** What the email link would contain, without sending an email (Supabase admin API). */
export async function recoveryTokenHash(email: string): Promise<string> {
  const res = await fetch(`${stack.url}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${stack.serviceKey}`, apikey: stack.serviceKey },
    body: JSON.stringify({ type: "recovery", email }),
  });
  const body = (await res.json()) as { hashed_token?: string; properties?: { hashed_token?: string } };
  const hash = body.properties?.hashed_token ?? body.hashed_token;
  if (!res.ok || !hash) throw new Error(`generate_link failed: ${res.status} ${JSON.stringify(body)}`);
  return hash;
}

/** RFC 6238 one-time code, exactly what an authenticator app shows for this secret right now. */
export function totp(base32Secret: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of base32Secret.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

/** The tests sign in far more often than a person would; clear the login counters first (they are tested on their own). */
export async function resetRateLimits() {
  await sql(`delete from rate_limits`);
}

export async function logIn(page: Page, password = stack.password, next?: string) {
  await resetRateLimits();
  await page.goto(next ? `admin/login?next=${encodeURIComponent(next)}` : "admin/login");
  await page.getByLabel("Email").fill(stack.email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
}

/** A success toast with this text appeared. */
export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.getByRole("status").filter({ hasText: text }).first()).toBeVisible();
}

export const PUBLIC_ARTICLE_CODE = "LS-SH-9100";

/** One live article (two colours, photos, stock) and contact details, so public pages can be tested with real rows. */
export async function seedPublicArticle() {
  const CODE = PUBLIC_ARTICLE_CODE;
  await sql(`insert into brands (name, is_public) select 'Leaf Star', true where not exists (select 1 from brands where lower(name) = 'leaf star')`);
  await sql(`update brands set is_public = true where lower(name) = 'leaf star'`);
  await sql(`update business_settings set phone = '919876543210', whatsapp = '919876543210', business_name = 'Leaf Star'`);
  if ((await sql(`select 1 from articles where code = $1`, [CODE])).length === 0) {
    // Seeded directly (the signed-in-staff function is covered by its own tests); same rows it would write.
    await sql(`
      do $$
      declare b uuid; a uuid; navy uuid; sky uuid; bt uuid; v uuid;
      begin
        select id into b from brands where lower(name) = 'leaf star';
        insert into articles (code, name, category, garment, fabric, pattern, moq, brand_id, is_public)
          values ('${CODE}', 'Public Check Shirt', 'upperwear', 'Shirt', 'Cotton', 'Check', 50, b, false) returning id into a;
        insert into article_colors (article_id, name, code, hex, sort_order) values (a, 'Navy', 'NVY', '#1C2B4A', 0) returning id into navy;
        insert into article_colors (article_id, name, code, hex, sort_order) values (a, 'Sky Blue', 'SKY', '#8FB3D9', 1) returning id into sky;
        insert into article_images (article_id, color_id, thumb_url, medium_url, url, width, height, sort_order) values
          (a, navy, '/dev/lab/pattern-1-thumb.webp', '/dev/lab/pattern-1-medium.webp', '/dev/lab/pattern-1-large.webp', 1600, 2000, 0),
          (a, navy, '/dev/lab/pattern-2-thumb.webp', '/dev/lab/pattern-2-medium.webp', '/dev/lab/pattern-2-large.webp', 1600, 2000, 1),
          (a, sky,  '/dev/lab/pattern-3-thumb.webp', '/dev/lab/pattern-3-medium.webp', '/dev/lab/pattern-3-large.webp', 1600, 2000, 0);
        insert into batches (code, produced_on) values ('B-PUBLIC-9100', current_date) returning id into bt;
        insert into variants (article_id, color_id, size, size_order, sku) values (a, navy, 'M', 2, '${CODE}-NVY-M') returning id into v;
        insert into stock_movements (variant_id, qty_change, reason, batch_id) values (v, 40, 'production', bt);
        insert into variants (article_id, color_id, size, size_order, sku) values (a, navy, 'L', 3, '${CODE}-NVY-L') returning id into v;
        insert into stock_movements (variant_id, qty_change, reason, batch_id) values (v, 30, 'production', bt);
        insert into variants (article_id, color_id, size, size_order, sku) values (a, sky, 'M', 2, '${CODE}-SKY-M') returning id into v;
        insert into stock_movements (variant_id, qty_change, reason, batch_id) values (v, 20, 'production', bt);
        update articles set is_public = true where id = a;
      end $$;
    `);
  }
}
