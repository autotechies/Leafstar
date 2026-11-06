import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, databaseUrl, OWNER_ID, refused, type TestDb } from "./harness";

/*
  The database's own guarantees (AGENTS.md §6, §7, §11, §15), proven on every push.
  These are the rules the app relies on; if one breaks, the build fails.
*/

if (process.env.CI && !databaseUrl()) {
  throw new Error("DATABASE_URL must be set in CI so the database tests always run");
}

const article = (overrides: Record<string, unknown> = {}) => ({
  article: { code: "ls-sh-0101", name: "Check Shirt", category: "upperwear", garment: "Shirt", fabric: "Cotton", moq: 100, is_public: true, ...overrides },
  sizes: ["S", "M", "XL"],
  colors: [
    {
      name: "Navy",
      code: "nvy",
      hex: "#1C2B4A",
      images: [{ thumb_url: "t1", medium_url: "m1", url: "l1", width: 1600, height: 2000 }],
      stock: { S: 60, M: 80, XL: 0 },
    },
    { name: "Sky", code: "sky", hex: "#8FB3D9", images: [{ thumb_url: "t2", medium_url: "m2", url: "l2" }], stock: { M: 40 } },
  ],
  // Batch codes are unique in the database, so each test article gets its own.
  batch: { code: `B-${String(overrides.code ?? "LS-SH-0101").toUpperCase()}`, produced_on: "2026-10-20", notes: "first" },
});

describe.skipIf(!databaseUrl())("database rules", () => {
  let db: TestDb;
  let brandId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const b = await db.admin.query<{ id: string }>(`insert into brands (name, is_public) values ('Leaf Star', true) returning id`);
    brandId = b.rows[0].id;
  }, 60_000);

  afterAll(async () => {
    await db?.drop();
  });

  const createArticle = (overrides: Record<string, unknown> = {}, who: "owner" | "stranger" = "owner") => {
    const payload = article({ brand_id: brandId, ...overrides });
    return db.as<{ id: string }>(who, `select create_article_full($1::jsonb) as id`, [JSON.stringify(payload)]);
  };

  const stock = async (sku: string) =>
    (await db.admin.query<{ stock: number }>(`select stock from variants where sku = $1`, [sku])).rows[0]?.stock;

  describe("Add Stock is one all-or-nothing call", () => {
    it("creates article, colours, size variants, photos, batch and opening stock together", async () => {
      await createArticle();
      const counts = await db.admin.query(`
        select (select count(*) from article_colors)::int as colours,
               (select count(*) from variants)::int as variants,
               (select coalesce(sum(stock), 0) from variants)::int as pieces,
               (select count(*) from batches)::int as batches,
               (select is_public from articles where code = 'LS-SH-0101') as live`);
      expect(counts.rows[0]).toEqual({ colours: 2, variants: 6, pieces: 180, batches: 1, live: true });
      expect(await stock("LS-SH-0101-NVY-S")).toBe(60);
      expect(await stock("LS-SH-0101-SKY-M")).toBe(40);
    });

    it("leaves nothing behind when any part fails (duplicate colour code)", async () => {
      const before = (await db.admin.query(`select count(*)::int as n from articles`)).rows[0].n;
      const bad = article({ brand_id: brandId, code: "LS-SH-0102" });
      bad.colors[1].code = "nvy";
      await refused(() => db.as("owner", `select create_article_full($1::jsonb)`, [JSON.stringify(bad)]));
      expect((await db.admin.query(`select count(*)::int as n from articles`)).rows[0].n).toBe(before);
      expect((await db.admin.query(`select count(*)::int as n from batches where code = 'B-LS-SH-0102'`)).rows[0].n).toBe(0);
    });

    it("refuses to publish an article whose colours have no photos", async () => {
      const noPhoto = article({ brand_id: brandId, code: "LS-SH-0103" });
      noPhoto.colors = [{ name: "Navy", code: "nvy", hex: "#1C2B4A", images: [], stock: { M: 5 } }];
      expect(await refused(() => db.as("owner", `select create_article_full($1::jsonb)`, [JSON.stringify(noPhoto)]))).toMatch(/photo/);
      expect((await db.admin.query(`select count(*)::int as n from articles where code = 'LS-SH-0103'`)).rows[0].n).toBe(0);
    });

    it("refuses anyone who is not the owner", async () => {
      expect(await refused(() => createArticle({ code: "LS-SH-0199" }, "stranger"))).toMatch(/Not allowed/);
    });

    it("adds stock to existing variants in one batch, and rejects a batch with a bad row entirely", async () => {
      const sky = (await db.admin.query(`select id from variants where sku = 'LS-SH-0101-SKY-M'`)).rows[0].id;
      await db.as("owner", `select add_stock_batch($1::jsonb)`, [JSON.stringify({ batch: { code: "B-002" }, rows: [{ variant_id: sky, qty: 25 }] })]);
      expect(await stock("LS-SH-0101-SKY-M")).toBe(65);
      await refused(() =>
        db.as("owner", `select add_stock_batch($1::jsonb)`, [
          JSON.stringify({ batch: { code: "B-003" }, rows: [{ variant_id: sky, qty: 5 }, { variant_id: sky, qty: -1 }] }),
        ]),
      );
      expect(await stock("LS-SH-0101-SKY-M")).toBe(65);
      expect((await db.admin.query(`select count(*)::int as n from batches where code = 'B-003'`)).rows[0].n).toBe(0);
    });
  });

  describe("the stock ledger", () => {
    it("cannot be edited or deleted, only added to", async () => {
      expect(await refused(() => db.admin.query(`update stock_movements set qty_change = 1`))).toMatch(/append-only/);
      expect(await refused(() => db.admin.query(`delete from stock_movements`))).toMatch(/append-only/);
    });

    it("never lets stock go below zero", async () => {
      const v = (await db.admin.query(`select id from variants where sku = 'LS-SH-0101-SKY-M'`)).rows[0].id;
      await refused(() => db.as("owner", `insert into stock_movements (variant_id, qty_change, reason, note) values ($1, -1000, 'adjustment', 'test')`, [v]));
      expect(await stock("LS-SH-0101-SKY-M")).toBe(65);
    });

    it("requires a written note on adjustments", async () => {
      const v = (await db.admin.query(`select id from variants where sku = 'LS-SH-0101-SKY-M'`)).rows[0].id;
      await refused(() => db.as("owner", `insert into stock_movements (variant_id, qty_change, reason) values ($1, -1, 'adjustment')`, [v]));
    });

    it("counts two changes to the same item made at the same time (no overwriting)", async () => {
      const v = (await db.admin.query(`select id from variants where sku = 'LS-SH-0101-NVY-M'`)).rows[0].id;
      const before = await stock("LS-SH-0101-NVY-M");
      // Two separate connections, as from two open tabs.
      const { Client } = await import("pg");
      const url = new URL(databaseUrl()!);
      url.pathname = `/${db.admin.database}`;
      const tabA = new Client({ connectionString: url.toString() });
      const tabB = new Client({ connectionString: url.toString() });
      await Promise.all([tabA.connect(), tabB.connect()]);
      await Promise.all([
        tabA.query(`insert into stock_movements (variant_id, qty_change, reason, note) values ($1, -3, 'adjustment', 'tab A')`, [v]),
        tabB.query(`insert into stock_movements (variant_id, qty_change, reason, note) values ($1, 5, 'adjustment', 'tab B')`, [v]),
      ]);
      await Promise.all([tabA.end(), tabB.end()]);
      expect(await stock("LS-SH-0101-NVY-M")).toBe((before ?? 0) + 2);
    });
  });

  describe("undo", () => {
    it("undoes a manual entry exactly once", async () => {
      const m = (await db.admin.query(`select id from stock_movements where qty_change = 60`)).rows[0].id;
      await db.as("owner", `select undo_movement($1)`, [m]);
      expect(await stock("LS-SH-0101-NVY-S")).toBe(0);
      expect(await refused(() => db.as("owner", `select undo_movement($1)`, [m]))).toMatch(/already undone/);
      const u = (await db.admin.query(`select id from stock_movements where reverses_movement_id = $1`, [m])).rows[0].id;
      expect(await refused(() => db.as("owner", `select undo_movement($1)`, [u]))).toMatch(/manual stock entries/);
    });

    it("refuses an undo that would take stock below zero", async () => {
      const v = (await db.admin.query(`select id from variants where sku = 'LS-SH-0101-SKY-M'`)).rows[0].id;
      const m = (await db.admin.query(`select id from stock_movements where variant_id = $1 and qty_change = 40`, [v])).rows[0].id;
      await db.as("owner", `insert into stock_movements (variant_id, qty_change, reason, note) values ($1, -60, 'adjustment', 'recount')`, [v]);
      await refused(() => db.as("owner", `select undo_movement($1)`, [m]));
    });

    it("applies and undoes a bill exactly, refuses duplicates and overselling", async () => {
      const v = (await db.admin.query(`select id from variants where sku = 'LS-SH-0101-NVY-M'`)).rows[0].id;
      const start = (await stock("LS-SH-0101-NVY-M"))!;
      const bill = await db.as<{ id: string }>("owner", `insert into bills (bill_number, bill_date) values ('LS/241', '2026-10-25') returning id`);
      const billId = bill.rows[0].id;
      await db.as("owner", `insert into bill_items (bill_id, variant_id, qty) values ($1, $2, 30)`, [billId, v]);
      await db.as("owner", `select apply_bill($1)`, [billId]);
      expect(await stock("LS-SH-0101-NVY-M")).toBe(start - 30);
      await db.as("owner", `select undo_bill($1)`, [billId]);
      expect(await stock("LS-SH-0101-NVY-M")).toBe(start);

      const dup1 = (await db.as<{ id: string }>("owner", `insert into bills (bill_number, bill_date) values ('LS/300', '2026-10-25') returning id`)).rows[0].id;
      const dup2 = (await db.as<{ id: string }>("owner", `insert into bills (bill_number, bill_date) values ('ls/300', '2026-10-25') returning id`)).rows[0].id;
      await db.as("owner", `insert into bill_items (bill_id, variant_id, qty) values ($1, $2, 1), ($3, $2, 1)`, [dup1, v, dup2]);
      await db.as("owner", `select apply_bill($1)`, [dup1]);
      await refused(() => db.as("owner", `select apply_bill($1)`, [dup2]));

      const big = (await db.as<{ id: string }>("owner", `insert into bills (bill_number, bill_date) values ('LS/999', '2026-10-25') returning id`)).rows[0].id;
      await db.as("owner", `insert into bill_items (bill_id, variant_id, qty) values ($1, $2, 100000)`, [big, v]);
      const before = await stock("LS-SH-0101-NVY-M");
      await refused(() => db.as("owner", `select apply_bill($1)`, [big]));
      expect(await stock("LS-SH-0101-NVY-M")).toBe(before);
    });
  });

  describe("what the public can and cannot see", () => {
    it("blocks every table for visitors", async () => {
      for (const t of ["articles", "variants", "leads", "bills", "business_settings", "rate_limits", "ai_usage", "faq_entries"]) {
        expect(await refused(() => db.as("anon", `select 1 from ${t} limit 1`))).toMatch(/permission denied/);
      }
    });

    it("keeps future tables closed to visitors by default", async () => {
      await db.admin.query(`create table zz_future (x int)`);
      const r = await db.admin.query(`select has_table_privilege('anon', 'zz_future', 'select') as ok`);
      expect(r.rows[0].ok).toBe(false);
      await db.admin.query(`drop table zz_future`);
    });

    it("shows only public, in-stock articles with no price and no exact stock", async () => {
      const hidden = await db.admin.query<{ id: string }>(`insert into brands (name, is_public) values ('Hidden Label', false) returning id`);
      await db.as("owner", `select create_article_full($1::jsonb)`, [JSON.stringify(article({ brand_id: hidden.rows[0].id, code: "LS-SH-0500" }))]);
      const rows = await db.as<Record<string, unknown>>("anon", `select * from public_catalog`);
      const codes = rows.rows.map((r) => r.code);
      expect(codes).toContain("LS-SH-0101");
      expect(codes).not.toContain("LS-SH-0500");
      const columns = Object.keys(rows.rows[0]);
      expect(columns).not.toContain("wholesale_price");
      expect(columns).not.toContain("stock");
      expect(JSON.stringify(rows.rows)).not.toMatch(/"stock"|wholesale/);
    });

    it("does not let visitors list photo files", async () => {
      const r = await db.admin.query(`select policyname from pg_policies where schemaname = 'storage' and 'anon' = any(roles)`);
      expect(r.rows).toEqual([]);
    });
  });

  describe("server-side safeguards", () => {
    it("rate limits per key and window", async () => {
      const allow = async (key: string) =>
        (await db.as<{ ok: boolean }>("service_role", `select rate_limit_allow($1, 2, 60) as ok`, [key])).rows[0].ok;
      expect([await allow("ip:1"), await allow("ip:1"), await allow("ip:1")]).toEqual([true, true, false]);
      expect(await allow("ip:2")).toBe(true);
      await refused(() => db.as("anon", `select rate_limit_allow('x', 1, 60)`));
    });

    it("stops AI when paused or over today's budget", async () => {
      const allowed = async () => (await db.as<{ ok: boolean }>("service_role", `select ai_allowed() as ok`)).rows[0].ok;
      expect(await allowed()).toBe(true);
      await db.admin.query(`update business_settings set ai_daily_token_budget = 100`);
      await db.admin.query(`insert into ai_usage (feature, input_tokens, output_tokens) values ('chat', 60, 50)`);
      expect(await allowed()).toBe(false);
      await db.admin.query(`update business_settings set ai_daily_token_budget = 1000000, ai_paused = true`);
      expect(await allowed()).toBe(false);
      await db.admin.query(`update business_settings set ai_paused = false`);
      expect(await allowed()).toBe(true);
    });

    it("recovers bill scans stuck in processing", async () => {
      await db.admin.query(`
        insert into bill_scan_jobs (batch_ref, file_path, status, attempts, started_at) values
          (gen_random_uuid(), 'a', 'processing', 1, now() - interval '30 minutes'),
          (gen_random_uuid(), 'b', 'processing', 3, now() - interval '30 minutes'),
          (gen_random_uuid(), 'c', 'processing', 1, now())`);
      await db.as("service_role", `select reset_stuck_scan_jobs()`);
      const r = await db.admin.query(`select file_path, status from bill_scan_jobs order by file_path`);
      expect(r.rows).toEqual([
        { file_path: "a", status: "queued" },
        { file_path: "b", status: "failed" },
        { file_path: "c", status: "processing" },
      ]);
    });

    it("deletes a colour's photos with the colour, but protects colours that have stock history", async () => {
      const a = (await db.admin.query(`select id from articles where code = 'LS-SH-0101'`)).rows[0].id;
      const c = await db.admin.query(`insert into article_colors (article_id, name, code, hex) values ($1, 'Temp', 'TMP', '#123456') returning id`, [a]);
      await db.admin.query(`insert into article_images (article_id, color_id, thumb_url, medium_url, url) values ($1, $2, 'a', 'b', 'c')`, [a, c.rows[0].id]);
      await db.admin.query(`delete from article_colors where id = $1`, [c.rows[0].id]);
      expect((await db.admin.query(`select count(*)::int as n from article_images where color_id = $1`, [c.rows[0].id])).rows[0].n).toBe(0);
      await refused(() => db.admin.query(`delete from article_colors where code = 'NVY'`));
    });
  });

  describe("two-step login (004_step2.sql)", () => {
    const ownerReads = async (who: "owner" | "owner-aal2") =>
      (await db.as(who, `select count(*)::int as n from business_settings`)).rows[0].n as number;

    it("lets the owner in with a password while two-step login is off", async () => {
      expect(await ownerReads("owner")).toBe(1);
    });

    it("once switched on, a password alone opens no data; passing the second step does", async () => {
      const f = await db.admin.query<{ id: string }>(
        `insert into auth.mfa_factors (user_id, status) values ($1, 'verified') returning id`, [OWNER_ID]);
      try {
        expect(await ownerReads("owner")).toBe(0);
        await refused(() => db.as("owner", `update business_settings set city = 'X'`).then((r) => {
          if (r.rowCount === 0) throw new Error("no rows updated");
        }));
        expect(await ownerReads("owner-aal2")).toBe(1);
      } finally {
        await db.admin.query(`delete from auth.mfa_factors where id = $1`, [f.rows[0].id]);
      }
    });

    it("treats brand names that differ only in capitals as the same brand", async () => {
      await db.admin.query(`insert into brands (name) values ('Case Test')`);
      await refused(() => db.admin.query(`insert into brands (name) values ('CASE test')`));
      await db.admin.query(`delete from brands where name = 'Case Test'`);
    });

    it("ignores an authenticator app that was started but never confirmed", async () => {
      const f = await db.admin.query<{ id: string }>(
        `insert into auth.mfa_factors (user_id, status) values ($1, 'unverified') returning id`, [OWNER_ID]);
      try {
        expect(await ownerReads("owner")).toBe(1);
      } finally {
        await db.admin.query(`delete from auth.mfa_factors where id = $1`, [f.rows[0].id]);
      }
    });
  });
  describe("photo records (005_image_system.sql)", () => {
    const folder = "a".repeat(32);
    const insertRecord = (f: string) =>
      db.admin.query(`insert into image_uploads (folder, width, height, blur_data_url) values ($1, 1600, 2000, 'data:image/webp;base64,AAAA')`, [f]);

    it("keeps photo records away from the public and from signed-in strangers", async () => {
      await insertRecord(folder);
      expect((await db.as("anon", `select count(*)::int as n from image_uploads`).catch(() => ({ rows: [{ n: -1 }] }))).rows[0].n).toBe(-1);
      expect((await db.as("stranger", `select count(*)::int as n from image_uploads`)).rows[0].n).toBe(0);
      expect((await db.as("owner", `select count(*)::int as n from image_uploads`)).rows[0].n).toBeGreaterThanOrEqual(1);
      await db.admin.query(`delete from image_uploads where folder = $1`, [folder]);
    });

    it("marks a photo as used when an article uses it, and only then protects it from cleanup", async () => {
      const used = "b".repeat(32);
      const unused = "c".repeat(32);
      await insertRecord(used);
      await insertRecord(unused);
      await db.admin.query(`update image_uploads set created_at = now() - interval '3 days'`);

      const payload = article({ brand_id: brandId, code: "LS-SH-0777" });
      payload.colors = [
        { name: "Red", code: "red", hex: "#BB3333", images: [{ thumb_url: `https://x/${used}/thumb.webp`, medium_url: `https://x/${used}/medium.webp`, url: `https://x/${used}/large.webp` }], stock: { M: 5 } },
      ];
      const created = await db.as("owner-aal2", `select create_article_full($1::jsonb)`, [JSON.stringify(payload)]);
      expect(created.rowCount).toBe(1);

      const state = await db.admin.query<{ folder: string; used: boolean }>(`select folder, attached_at is not null as used from image_uploads where folder in ($1, $2)`, [used, unused]);
      expect(Object.fromEntries(state.rows.map((r) => [r.folder, r.used]))).toEqual({ [used]: true, [unused]: false });

      const orphans = await db.admin.query<{ orphan_image_folders: string }>(`select orphan_image_folders('1 day')`);
      expect(orphans.rows.map((r) => r.orphan_image_folders)).toEqual([unused]);
      const forgotten = await db.admin.query<{ n: number }>(`select forget_image_folders(array[$1, $2]) as n`, [used, unused]);
      expect(forgotten.rows[0].n).toBe(1); // the used one is never forgotten
    });

    it("lets only the server run the cleanup helpers", async () => {
      for (const who of ["anon", "stranger", "owner"] as const) {
        await refused(() => db.as(who, `select orphan_image_folders('1 day')`));
        await refused(() => db.as(who, `select forget_image_folders(array['x'])`));
      }
      await db.as("service_role", `select orphan_image_folders('1 day')`);
    });
  });
  describe("stock entry helpers (006_stock_entries.sql)", () => {
    const stockOf = async (sku: string) => (await db.admin.query<{ stock: number }>(`select stock from variants where sku = $1`, [sku])).rows[0]?.stock;

    it("undoes a whole new-article entry at once and archives the article", async () => {
      const payload = article({ brand_id: brandId, code: "LS-SH-0801" });
      const made = await db.as("owner-aal2", `select create_article_full($1::jsonb) as id`, [JSON.stringify(payload)]);
      const aid = made.rows[0].id;
      const batch = (await db.admin.query<{ id: string }>(`select id from batches where code = 'B-LS-SH-0801'`)).rows[0].id;
      expect(await stockOf("LS-SH-0801-NVY-S")).toBe(60);
      const n = await db.as("owner-aal2", `select undo_batch($1, $2) as n`, [batch, aid]);
      expect(n.rows[0].n).toBe(3); // three non-zero entries
      expect(await stockOf("LS-SH-0801-NVY-S")).toBe(0);
      expect((await db.admin.query(`select is_active, is_public from articles where id = $1`, [aid])).rows[0]).toEqual({ is_active: false, is_public: false });
      // Once only.
      await refused(() => db.as("owner-aal2", `select undo_batch($1, $2)`, [batch, aid]));
    });

    it("refuses to undo a batch when later sales would take stock below zero, and changes nothing", async () => {
      const made = await db.as("owner-aal2", `select create_article_full($1::jsonb) as id`, [JSON.stringify(article({ brand_id: brandId, code: "LS-SH-0802" }))]);
      expect(made.rowCount).toBe(1);
      const batch = (await db.admin.query<{ id: string }>(`select id from batches where code = 'B-LS-SH-0802'`)).rows[0].id;
      const v = (await db.admin.query<{ id: string }>(`select id from variants where sku = 'LS-SH-0802-NVY-S'`)).rows[0].id;
      await db.as("owner-aal2", `insert into stock_movements (variant_id, qty_change, reason, note) values ($1, -50, 'adjustment', 'sold outside the system')`, [v]);
      await refused(() => db.as("owner-aal2", `select undo_batch($1)`, [batch]));
      expect(await stockOf("LS-SH-0802-NVY-S")).toBe(10);
      expect(await stockOf("LS-SH-0802-SKY-M")).toBe(40);
    });

    it("hands out the next free article code per type", async () => {
      const r = await db.as("owner-aal2", `select next_article_code('SH') as c, next_article_code('PN') as p`);
      expect(r.rows[0].p).toBe("LS-PN-0001");
      expect(r.rows[0].c).toMatch(/^LS-SH-\d{4}$/);
      expect(Number(r.rows[0].c.slice(-4))).toBeGreaterThan(802);
      await refused(() => db.as("owner-aal2", `select next_article_code('XX')`));
      await refused(() => db.as("stranger", `select next_article_code('SH')`));
    });

    const importPayload = (code: string, overrides: Record<string, unknown> = {}) => ({
      batch: { code: `IMP-${code}`, produced_on: "2026-11-01", notes: "Excel import" },
      articles: [
        {
          code, name: "Imported Shirt", category: "upperwear", garment: "Shirt", brand_id: brandId, moq: 50,
          colors: [{ name: "Navy", code: "NVY", hex: "#1C2B4A", stock: { S: 10, M: 20 } }, { name: "Sky", code: "SKY", hex: "#8FB3D9", stock: { M: 5 } }],
          ...overrides,
        },
      ],
    });

    it("imports new and existing articles in one batch, as hidden drafts, and adds to existing stock", async () => {
      await db.as("owner-aal2", `select import_stock($1::jsonb)`, [JSON.stringify(importPayload("LS-SH-0900"))]);
      expect(await stockOf("LS-SH-0900-NVY-S")).toBe(10);
      expect((await db.admin.query(`select is_public from articles where code = 'LS-SH-0900'`)).rows[0].is_public).toBe(false);
      // Second import of the same article adds, never replaces.
      await db.as("owner-aal2", `select import_stock($1::jsonb)`, [JSON.stringify(importPayload("LS-SH-0900"))].map((x) => x.replace("IMP-LS-SH-0900", "IMP-LS-SH-0900-B")));
      expect(await stockOf("LS-SH-0900-NVY-S")).toBe(20);
      expect(await stockOf("LS-SH-0900-SKY-M")).toBe(10);
      expect((await db.admin.query(`select count(*)::int as n from article_colors where article_id = (select id from articles where code = 'LS-SH-0900')`)).rows[0].n).toBe(2);
    });

    it("leaves nothing behind when one imported row is wrong", async () => {
      const before = (await db.admin.query(`select (select count(*) from articles)::int as a, (select count(*) from batches)::int as b, (select coalesce(sum(stock),0) from variants)::int as s`)).rows[0];
      const bad = importPayload("LS-SH-0901", { colors: [{ name: "Navy", code: "NVY", hex: "#1C2B4A", stock: { S: 10 } }, { name: "Bad", code: "BAD", hex: "not-a-colour", stock: { S: 3 } }] });
      await refused(() => db.as("owner-aal2", `select import_stock($1::jsonb)`, [JSON.stringify(bad)]));
      const after = (await db.admin.query(`select (select count(*) from articles)::int as a, (select count(*) from batches)::int as b, (select coalesce(sum(stock),0) from variants)::int as s`)).rows[0];
      expect(after).toEqual(before);
    });

    it("lets only signed-in staff import or undo", async () => {
      await refused(() => db.as("anon", `select import_stock('{}'::jsonb)`));
      await refused(() => db.as("stranger", `select import_stock($1::jsonb)`, [JSON.stringify(importPayload("LS-SH-0902"))]));
    });
  });
  describe("inventory helpers (007_inventory.sql)", () => {
    const sku = async (s: string) => (await db.admin.query<{ stock: number }>(`select stock from variants where sku = $1`, [s])).rows[0]?.stock;
    let aid: string;
    const img = (n: string) => ({ thumb_url: `https://x/${n}/thumb.webp`, medium_url: `https://x/${n}/medium.webp`, url: `https://x/${n}/large.webp`, width: 1600, height: 2000 });

    it("adds a colour to an existing article with a variant for every size and opening stock", async () => {
      const made = await db.as("owner-aal2", `select create_article_full($1::jsonb) as id`, [JSON.stringify(article({ brand_id: brandId, code: "LS-SH-0950" }))]);
      aid = made.rows[0].id;
      const c = await db.as("owner-aal2", `select add_colour($1::jsonb) as id`, [JSON.stringify({ article_id: aid, name: "Olive", code: "olv", hex: "#5B6B35", images: [img("o1")], stock: { M: 25, S: 0 } })]);
      expect(c.rows[0].id).toBeTruthy();
      expect(await sku("LS-SH-0950-OLV-M")).toBe(25);
      expect(await sku("LS-SH-0950-OLV-S")).toBe(0);
      expect(await sku("LS-SH-0950-OLV-XL")).toBe(0);
      expect((await db.admin.query(`select count(*)::int as n from article_images where color_id = $1`, [c.rows[0].id])).rows[0].n).toBe(1);
    });

    it("refuses a colour with a duplicate code, leaving nothing behind", async () => {
      const before = (await db.admin.query(`select count(*)::int as n from article_colors where article_id = $1`, [aid])).rows[0].n;
      await refused(() => db.as("owner-aal2", `select add_colour($1::jsonb)`, [JSON.stringify({ article_id: aid, name: "Olive 2", code: "OLV", hex: "#5B6B35", stock: { M: 5 } })]));
      expect((await db.admin.query(`select count(*)::int as n from article_colors where article_id = $1`, [aid])).rows[0].n).toBe(before);
    });

    it("adds a size to every colour once", async () => {
      expect((await db.as("owner-aal2", `select add_size($1, 'L') as n`, [aid])).rows[0].n).toBe(3);
      expect(await sku("LS-SH-0950-NVY-L")).toBe(0);
      await refused(() => db.as("owner-aal2", `select add_size($1, 'L')`, [aid]));
    });

    it("replaces a colour's photos and releases the old files for cleanup", async () => {
      const color = (await db.admin.query<{ id: string }>(`select id from article_colors where article_id = $1 and code = 'OLV'`, [aid])).rows[0].id;
      const oldFolder = "d".repeat(32);
      await db.admin.query(`insert into image_uploads (folder, width, height, blur_data_url, attached_at) values ($1, 1600, 2000, 'data:image/webp;base64,AAAA', now())`, [oldFolder]);
      await db.admin.query(`update article_images set url = $2 where color_id = $1`, [color, `https://x/${oldFolder}/large.webp`]);
      const n = await db.as("owner-aal2", `select set_colour_photos($1, $2::jsonb) as n`, [color, JSON.stringify([img("n1"), img("n2")])]);
      expect(n.rows[0].n).toBe(2);
      const urls = (await db.admin.query<{ url: string }>(`select url from article_images where color_id = $1 order by sort_order`, [color])).rows.map((r) => r.url);
      expect(urls).toEqual(["https://x/n1/large.webp", "https://x/n2/large.webp"]);
      expect((await db.admin.query(`select attached_at from image_uploads where folder = $1`, [oldFolder])).rows[0].attached_at).toBeNull();
      await refused(() => db.as("owner-aal2", `select set_colour_photos($1, '[]'::jsonb)`, [color]));
    });

    it("keeps these helpers away from anyone who is not signed-in staff", async () => {
      await refused(() => db.as("anon", `select add_size($1, 'XL')`, [aid]));
      await refused(() => db.as("stranger", `select add_colour('{}'::jsonb)`));
    });
  });
});
