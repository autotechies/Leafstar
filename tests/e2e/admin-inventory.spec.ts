import { expect, test } from "@playwright/test";
import { hasStack, logIn, sql } from "./helpers";

/* Inventory (Step 5) against the real local Supabase stack: list filters, correction rules, undo once, archive. */

test.skip(!hasStack, "needs the local Supabase stack (run through scripts/e2e.mjs with DATABASE_URL)");
test.describe.configure({ mode: "serial" });

const CODE = "LS-SH-9001";
const stockOf = async (sku: string) => (await sql<{ stock: number }>(`select stock from variants where sku = $1`, [sku]))[0]?.stock;

test.beforeAll(async () => {
  await sql(`insert into brands (name, is_public) select 'Leaf Star', true where not exists (select 1 from brands where lower(name) = 'leaf star')`);
});

test.beforeEach(async ({ page }) => {
  await logIn(page);
  await expect(page).toHaveURL(/\/admin$/);
});

async function seed(page: import("@playwright/test").Page) {
  if ((await sql(`select 1 from articles where code = $1`, [CODE])).length) return;
  await page.goto("admin/stock/add", { waitUntil: "networkidle" });
  await page.getByLabel("Type").selectOption("Shirt");
  await page.getByLabel("Article code").fill(CODE);
  await page.getByLabel("Article name").fill("Inventory Shirt");
  await page.getByLabel("Brand").selectOption({ label: "Leaf Star" });
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Navy", exact: true }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Navy M pieces").fill("10");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Save article" }).click();
  await expect(page.getByRole("status").filter({ hasText: `${CODE} saved` })).toBeVisible();
}

test("lists the article and the out-of-stock filter works", async ({ page }) => {
  await seed(page);
  await page.goto("admin/inventory", { waitUntil: "networkidle" });
  await expect(page.getByText(CODE).first()).toBeVisible();
  await page.goto("admin/inventory?stock=out", { waitUntil: "networkidle" });
  await expect(page.getByText(CODE)).toHaveCount(0);
});

test("a correction needs a reason, cannot go below zero, and can be undone once", async ({ page }) => {
  await seed(page);
  await page.goto(`admin/inventory/${CODE}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Navy M: 10 pieces/ }).click();
  await page.getByLabel(/Pieces to add/).fill("-3");
  await page.getByRole("button", { name: "Save correction" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  expect(await stockOf(`${CODE}-NVY-M`)).toBe(10);

  await page.getByLabel("Reason").fill("Damaged in packing");
  await page.getByLabel(/Pieces to add/).fill("-50");
  await page.getByRole("button", { name: "Save correction" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  expect(await stockOf(`${CODE}-NVY-M`)).toBe(10);

  await page.getByLabel(/Pieces to add/).fill("-3");
  await page.getByRole("button", { name: "Save correction" }).click();
  await expect.poll(() => stockOf(`${CODE}-NVY-M`)).toBe(7);

  await page.getByRole("status").filter({ hasText: "is now 7" }).getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => stockOf(`${CODE}-NVY-M`)).toBe(10);
  await page.reload({ waitUntil: "networkidle" });
  const corrections = page.getByRole("row").filter({ hasText: "Damaged in packing" });
  await expect(corrections.first()).toContainText("undone");
  await expect(corrections.getByRole("button", { name: "Undo" })).toHaveCount(0);
});

test("archiving keeps the history and restore brings it back hidden", async ({ page }) => {
  await seed(page);
  await page.goto(`admin/inventory/${CODE}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Archive" }).click();
  await expect.poll(async () => (await sql<{ is_active: boolean }>(`select is_active from articles where code = $1`, [CODE]))[0].is_active).toBe(false);
  await page.getByRole("button", { name: "Restore" }).click();
  await expect.poll(async () => (await sql<{ is_active: boolean }>(`select is_active from articles where code = $1`, [CODE]))[0].is_active).toBe(true);
  expect((await sql<{ is_public: boolean }>(`select is_public from articles where code = $1`, [CODE]))[0].is_public).toBe(false);
});
