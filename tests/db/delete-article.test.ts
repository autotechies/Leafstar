import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, databaseUrl, refused, type TestDb } from "./harness";

/*
  Deleting an article (013_delete_article.sql).
  An article can be deleted only when nothing real depends on it. The owner's own stock entries go with it, and the
  stock ledger stays append-only for everything else.
*/

if (process.env.CI && !databaseUrl()) {
  throw new Error("DATABASE_URL must be set in CI so the database tests always run");
}

const payload = (code: string, brandId: string) => ({
  article: { code, name: `Shirt ${code}`, category: "upperwear", garment: "Shirt", fabric: "Cotton", moq: 50, brand_id: brandId, is_public: true },
  sizes: ["S", "M"],
  colors: [
    { name: "Navy", code: "nvy", hex: "#1C2B4A", images: [{ thumb_url: "t1", medium_url: "m1", url: `https://x/${code}-nvy/large.webp` }], stock: { S: 60, M: 80 } },
    { name: "Sky", code: "sky", hex: "#8FB3D9", images: [{ thumb_url: "t2", medium_url: "m2", url: `https://x/${code}-sky/large.webp` }], stock: { M: 40 } },
  ],
  batch: { code: `B-${code}`, produced_on: "2026-11-01", notes: "test stock" },
});

describe.skipIf(!databaseUrl())("deleting an article (013)", () => {
  let db: TestDb;
  let brandId: string;

  beforeAll(async () => {
    db = await createTestDb();
    brandId = (await db.admin.query<{ id: string }>(`insert into brands (name, is_public) values ('Leaf Star', true) returning id`)).rows[0].id;
  }, 60_000);

  afterAll(async () => {
    await db?.drop();
  });

  const make = async (code: string) => {
    const r = await db.as<{ id: string }>("owner-aal2", `select create_article_full($1::jsonb) as id`, [JSON.stringify(payload(code, brandId))]);
    return r.rows[0].id;
  };
  const updatedAt = async (id: string) => (await db.admin.query<{ t: string }>(`select updated_at::text as t from articles where id = $1`, [id])).rows[0].t;
  const count = async (sql: string, params: unknown[] = []) => (await db.admin.query<{ n: number }>(sql, params)).rows[0].n;
  const del = async (id: string) => db.as<{ r: { code: string; entries: number; batches: number } }>("owner-aal2", `select delete_article($1, $2::timestamptz) as r`, [id, await updatedAt(id)]);
  const report = async (id: string) => (await db.as<{ r: { can_delete: boolean; blockers: string[]; entries: number; pieces: number; colours: number; photos: number } }>("owner-aal2", `select article_delete_report($1) as r`, [id])).rows[0].r;

  it("removes a test article with stock, colours, sizes, photos and its own stock entries, and frees its codes", async () => {
    const id = await make("LS-SH-0201");
    const sku = (await db.admin.query<{ id: string }>(`select id from variants where sku = 'LS-SH-0201-NVY-S'`)).rows[0].id;
    // A correction and an undo are the owner's own entries too.
    await db.as("owner-aal2", `insert into stock_movements (variant_id, qty_change, reason, note) values ($1, -5, 'adjustment', 'miscount')`, [sku]);
    const mv = (await db.admin.query<{ id: string }>(`select id from stock_movements where variant_id = $1 and reason = 'adjustment'`, [sku])).rows[0].id;
    await db.as("owner-aal2", `select undo_movement($1, 'oops')`, [mv]);

    const rep = await report(id);
    expect(rep).toMatchObject({ can_delete: true, blockers: [], colours: 2, photos: 2, pieces: 180 });
    expect(rep.entries).toBe(5); // 3 production + 1 correction + 1 undo

    const res = await del(id);
    expect(res.rows[0].r).toMatchObject({ code: "LS-SH-0201", entries: 5, batches: 1 });

    expect(await count(`select count(*)::int as n from articles where id = $1`, [id])).toBe(0);
    expect(await count(`select count(*)::int as n from variants where article_id = $1`, [id])).toBe(0);
    expect(await count(`select count(*)::int as n from article_colors where article_id = $1`, [id])).toBe(0);
    expect(await count(`select count(*)::int as n from article_images where article_id = $1`, [id])).toBe(0);
    expect(await count(`select count(*)::int as n from stock_movements where variant_id = $1`, [sku])).toBe(0);
    expect(await count(`select count(*)::int as n from batches where code = 'B-LS-SH-0201'`)).toBe(0);

    // The code, SKUs and batch code can be used again.
    await make("LS-SH-0201");
    expect(await count(`select count(*)::int as n from variants where sku = 'LS-SH-0201-NVY-S'`)).toBe(1);
  });

  it("writes what it removed to the audit log", async () => {
    const id = await make("LS-SH-0202");
    await del(id);
    const ledger = (await db.admin.query(`select old_data, new_data, action from audit_log where table_name = 'stock_movements' and row_id = $1`, [id])).rows;
    expect(ledger).toHaveLength(1);
    expect(ledger[0].action).toBe("DELETE");
    expect(ledger[0].old_data.article_code).toBe("LS-SH-0202");
    expect(ledger[0].old_data.entries).toHaveLength(3);
    expect(await count(`select count(*)::int as n from audit_log where table_name = 'articles' and row_id = $1 and action = 'DELETE'`, [id])).toBe(1);
  });

  it("keeps the ledger append-only for everyone else, before and after a delete", async () => {
    const keep = await make("LS-SH-0203");
    const gone = await make("LS-SH-0204");
    await del(gone);
    const v = (await db.admin.query<{ id: string }>(`select id from variants where article_id = $1 limit 1`, [keep])).rows[0].id;
    expect(await refused(() => db.admin.query(`delete from stock_movements where variant_id = $1`, [v]))).toMatch(/append-only/);
    expect(await refused(() => db.admin.query(`update stock_movements set qty_change = 1 where variant_id = $1`, [v]))).toMatch(/append-only/);
    expect(await refused(() => db.as("owner-aal2", `delete from stock_movements where variant_id = $1`, [v]))).toMatch(/append-only/);
    expect(await count(`select count(*)::int as n from stock_movements where variant_id = $1`, [v])).toBeGreaterThan(0);
  });

  it("keeps a stock entry group that another article still uses", async () => {
    const a = await make("LS-SH-0205");
    const b = await make("LS-SH-0206");
    const batchA = (await db.admin.query<{ id: string }>(`select id from batches where code = 'B-LS-SH-0205'`)).rows[0].id;
    const vb = (await db.admin.query<{ id: string }>(`select id from variants where article_id = $1 limit 1`, [b])).rows[0].id;
    await db.as("owner-aal2", `insert into stock_movements (variant_id, qty_change, reason, batch_id) values ($1, 10, 'production', $2)`, [vb, batchA]);
    const res = await del(a);
    expect(res.rows[0].r.batches).toBe(0);
    expect(await count(`select count(*)::int as n from batches where id = $1`, [batchA])).toBe(1);
  });

  it("refuses when a scanned bill has a line for it, and changes nothing", async () => {
    const id = await make("LS-SH-0207");
    const v = (await db.admin.query<{ id: string }>(`select id from variants where sku = 'LS-SH-0207-NVY-S'`)).rows[0].id;
    const bill = (await db.as<{ id: string }>("owner-aal2", `insert into bills (bill_number, bill_date) values ('LS/D1', '2026-11-02') returning id`)).rows[0].id;
    await db.as("owner-aal2", `insert into bill_items (bill_id, variant_id, qty) values ($1, $2, 5)`, [bill, v]);
    const rep = await report(id);
    expect(rep.can_delete).toBe(false);
    expect(rep.blockers[0]).toMatch(/1 scanned bill/);
    expect(await refused(() => del(id))).toMatch(/must be kept/);
    expect(await count(`select count(*)::int as n from articles where id = $1`, [id])).toBe(1);
    expect(await count(`select count(*)::int as n from stock_movements where variant_id = $1`, [v])).toBe(1);
  });

  it("refuses once a bill has taken stock out (a sale)", async () => {
    const id = await make("LS-SH-0208");
    const v = (await db.admin.query<{ id: string }>(`select id from variants where sku = 'LS-SH-0208-NVY-S'`)).rows[0].id;
    const bill = (await db.as<{ id: string }>("owner-aal2", `insert into bills (bill_number, bill_date) values ('LS/D2', '2026-11-02') returning id`)).rows[0].id;
    await db.as("owner-aal2", `insert into bill_items (bill_id, variant_id, qty) values ($1, $2, 10)`, [bill, v]);
    await db.as("owner-aal2", `select apply_bill($1)`, [bill]);
    await refused(() => del(id));
    expect(await count(`select stock::int as n from variants where id = $1`, [v])).toBe(50);
  });

  it("refuses when a buyer lead asked about it", async () => {
    const id = await make("LS-SH-0209");
    await db.as("service_role", `select create_lead($1::jsonb)`, [JSON.stringify({ name: "Ravi", phone: "919800000009", source: "request_price", message: "Need 100", items: [{ article_id: id, quantity: 100 }] })]);
    const rep = await report(id);
    expect(rep.can_delete).toBe(false);
    expect(rep.blockers[0]).toMatch(/1 buyer lead/);
    expect(await refused(() => del(id))).toMatch(/Archive it instead/);
  });

  it("refuses when its stock history holds a return", async () => {
    const id = await make("LS-SH-0210");
    const v = (await db.admin.query<{ id: string }>(`select id from variants where sku = 'LS-SH-0210-NVY-S'`)).rows[0].id;
    await db.as("owner-aal2", `insert into stock_movements (variant_id, qty_change, reason, note) values ($1, 3, 'return', 'buyer sent back')`, [v]);
    const rep = await report(id);
    expect(rep.can_delete).toBe(false);
    expect(rep.blockers[0]).toMatch(/sale or return/);
    await refused(() => del(id));
  });

  it("refuses when the article changed since it was opened", async () => {
    const id = await make("LS-SH-0211");
    const stale = await updatedAt(id);
    await db.as("owner-aal2", `update articles set name = 'Renamed' where id = $1`, [id]);
    expect(await refused(() => db.as("owner-aal2", `select delete_article($1, $2::timestamptz)`, [id, stale]))).toMatch(/changed since you opened it/);
    expect(await count(`select count(*)::int as n from articles where id = $1`, [id])).toBe(1);
  });

  it("releases the photo files so the daily cleanup removes them", async () => {
    const id = await make("LS-SH-0212");
    const folder = "e".repeat(32);
    await db.admin.query(`insert into image_uploads (folder, width, height, blur_data_url, attached_at) values ($1, 1600, 2000, 'data:image/webp;base64,AAAA', now())`, [folder]);
    await db.admin.query(`update article_images set url = $2 where article_id = $1 and url like '%nvy%'`, [id, `https://x/${folder}/large.webp`]);
    await del(id);
    expect((await db.admin.query(`select attached_at from image_uploads where folder = $1`, [folder])).rows[0].attached_at).toBeNull();
  });

  it("is only for signed-in staff", async () => {
    const id = await make("LS-SH-0213");
    const at = await updatedAt(id);
    for (const who of ["anon", "stranger"] as const) {
      await refused(() => db.as(who, `select delete_article($1, $2::timestamptz)`, [id, at]));
      await refused(() => db.as(who, `select article_delete_report($1)`, [id]));
    }
    expect(await count(`select count(*)::int as n from articles where id = $1`, [id])).toBe(1);
  });
});
