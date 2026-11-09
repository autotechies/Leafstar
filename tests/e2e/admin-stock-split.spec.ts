import { expect, test } from "@playwright/test";
import { expectToast, hasStack, logIn, sql } from "./helpers";

/*
  An assorted bill line ("Sizes S-XXL, Assorted Colours") cannot say which pieces to deduct. The review screen suggests a
  split from current stock; the owner confirms it, and only then are ordinary colour-and-size lines saved.
*/

test.skip(!hasStack, "needs the local Supabase stack (run through scripts/e2e.mjs with DATABASE_URL)");

let billId = "";
const CODE = "LS-SH-0077";

test.beforeAll(async () => {
  const brand = (await sql<{ id: string }>(`insert into brands (name, is_public) values ('Split Test Brand', true) returning id`))[0].id;
  const art = (await sql<{ id: string }>(`insert into articles (code, name, category, garment, brand_id, moq) values ($1,'Split Shirt','upperwear','Shirt',$2,50) returning id`, [CODE, brand]))[0].id;
  const perSize: Record<string, number> = { NVY: 60, SKY: 40, GRY: 20 };
  let order = 0;
  for (const [code, name, hex] of [["NVY", "Navy", "#1C2B4A"], ["SKY", "Sky Blue", "#8FB3D9"], ["GRY", "Grey", "#888888"]] as const) {
    const cid = (await sql<{ id: string }>(`insert into article_colors (article_id, name, code, hex, sort_order) values ($1,$2,$3,$4,$5) returning id`, [art, name, code, hex, order++]))[0].id;
    for (const [i, size] of ["S", "M", "L", "XL", "XXL"].entries()) {
      const v = (await sql<{ id: string }>(`insert into variants (article_id, color_id, size, size_order, sku) values ($1,$2,$3,$4,$5) returning id`, [art, cid, size, i, `${CODE}-${code}-${size}`]))[0].id;
      await sql(`insert into stock_movements (variant_id, qty_change, reason, note) values ($1,$2,'opening','test')`, [v, perSize[code]]);
    }
  }
  billId = (await sql<{ id: string }>(`insert into bills (bill_number, bill_date, buyer_name_raw, status) values ('SPLIT/1','2026-11-01','Split Buyer','draft') returning id`))[0].id;
  await sql(
    `insert into bill_items (bill_id, raw_text, extracted_name, extracted_color, extracted_size, qty, rate, amount) values ($1,$2,$3,'Assorted Colours','S-XXL',300,450,135000)`,
    [billId, `1 ${CODE} Split Shirt (Sizes: S-XXL, Assorted Colours) 300 450.00`, `${CODE} Split Shirt (Sizes: S-XXL, Assorted Colours)`],
  );
});

test("an assorted line gets a suggested split from stock; accepting it saves ordinary lines that add up", async ({ page }) => {
  await logIn(page);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(`admin/bills/review/${billId}`, { waitUntil: "networkidle" });
  const box = page.getByText("Suggested split of 300 pieces").locator("..");
  await expect(box).toBeVisible();
  await expect(box).toContainText("Based on what we hold now");
  await box.getByRole("button", { name: "Use this split" }).click();

  // One line per colour and size, each a normal matched line the owner can still edit.
  await expect(page.getByText("Suggested split")).toHaveCount(0);
  await expect(page.getByLabel("Pieces")).toHaveCount(15);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expectToast(page, "Draft saved.");

  const rows = await sql<{ qty: number; sku: string; method: string }>(
    `select i.qty, v.sku, i.match_method as method from bill_items i join variants v on v.id = i.variant_id where i.bill_id = $1 order by v.sku`,
    [billId],
  );
  expect(rows).toHaveLength(15);
  expect(rows.reduce((s, r) => s + r.qty, 0)).toBe(300);
  expect(rows.every((r) => r.method === "manual")).toBe(true);
  // Proportional to stock (Navy 300 : Sky 200 : Grey 100 of 600), never above what is held.
  const by = (colour: string) => rows.filter((r) => r.sku.includes(`-${colour}-`)).reduce((s, r) => s + r.qty, 0);
  expect([by("NVY"), by("SKY"), by("GRY")]).toEqual([150, 100, 50]);
  // Nothing was deducted: only Deduct stock does that.
  expect((await sql<{ n: number }>(`select coalesce(sum(stock),0)::int as n from variants where sku like '${CODE}-%'`))[0].n).toBe(600);
});
