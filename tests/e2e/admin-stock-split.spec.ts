import { expect, test } from "@playwright/test";
import { expectToast, hasStack, logIn, sql } from "./helpers";

/*
  An assorted bill line ("Sizes S-XXL, Assorted Colours") cannot say which pieces to deduct. The owner splits it by hand with
  "Split this line"; a summary under the lines shows what was chosen and whether it adds up to the bill.
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

test("an assorted line is split by hand and a summary shows what was chosen", async ({ page }) => {
  await logIn(page);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(`admin/bills/review/${billId}`, { waitUntil: "networkidle" });
  // No automatic suggestion: the owner chooses.
  await expect(page.getByText("Suggested split")).toHaveCount(0);
  await expect(page.getByText(/does not name one colour and size/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /What you chose for/ })).toHaveCount(0);

  await page.getByLabel("Article").nth(0).selectOption({ index: 1 });
  await page.getByLabel("Pieces").nth(0).fill("100");
  await page.getByRole("button", { name: "Split this line" }).first().click();
  await page.getByLabel("Article").nth(1).selectOption({ index: 6 });
  await page.getByLabel("Pieces").nth(1).fill("120");
  await page.getByRole("button", { name: "Split this line" }).first().click();
  await page.getByLabel("Article").nth(1).selectOption({ index: 11 });

  const summary = page.getByRole("region", { name: "Split summary for LS-SH-0077" }).or(page.locator('[aria-label="Split summary for LS-SH-0077"]'));
  await expect(summary).toContainText("What you chose for LS-SH-0077");
  await expect(summary.getByRole("status")).toContainText("220 of 300 pieces placed. 80 still to place.");
  await page.getByLabel("Pieces").nth(1).fill("80");
  await expect(summary.getByRole("status")).toContainText("All 300 pieces on the bill are placed.");
  await expect(summary.getByRole("row")).toHaveCount(4); // header + 3 chosen lines
  await expect(summary).toContainText("Navy");

  await page.getByRole("button", { name: "Save draft" }).click();
  await expectToast(page, "Draft saved.");
  const rows = await sql<{ qty: number }>(`select qty from bill_items where bill_id = $1 and variant_id is not null`, [billId]);
  expect(rows).toHaveLength(3);
  expect(rows.reduce((n, r) => n + r.qty, 0)).toBe(300);
  expect((await sql<{ n: number }>(`select coalesce(sum(stock),0)::int as n from variants where sku like '${CODE}-%'`))[0].n).toBe(600);
});
