import { expect, test, type Page } from "@playwright/test";
import { hasStack, logIn, sql } from "./helpers";

/* Delete an article (migration 013) against the real local Supabase stack: allowed only when nothing real depends on it. */

test.skip(!hasStack, "needs the local Supabase stack (run through scripts/e2e.mjs with DATABASE_URL)");
test.describe.configure({ mode: "serial" });

const CLEAN = "LS-SH-9101";
const BUSY = "LS-SH-9102";

test.beforeAll(async () => {
  await sql(`insert into brands (name, is_public) select 'Leaf Star', true where not exists (select 1 from brands where lower(name) = 'leaf star')`);
});

test.beforeEach(async ({ page }) => {
  await logIn(page);
  await expect(page).toHaveURL(/\/admin$/);
});

async function seed(page: Page, code: string, name: string) {
  if ((await sql(`select 1 from articles where code = $1`, [code])).length) return;
  await page.goto("admin/stock/add", { waitUntil: "networkidle" });
  await page.getByLabel("Type").selectOption("Shirt");
  await page.getByLabel("Article code").fill(code);
  await page.getByLabel("Article name").fill(name);
  await page.getByLabel("Brand").selectOption({ label: "Leaf Star" });
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Navy", exact: true }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Navy M pieces").fill("10");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Save article" }).click();
  await expect(page.getByRole("status").filter({ hasText: `${code} saved` })).toBeVisible();
}

test("deletes an article with no history, but only after its code is typed", async ({ page }) => {
  await seed(page, CLEAN, "Test Delete Shirt");
  await page.goto(`admin/inventory/${CLEAN}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Delete this article?" })).toBeVisible();
  await expect(page.getByText(/1 stock entry in its history \(10 pieces in stock now\)/)).toBeVisible();
  const confirmButton = page.getByRole("button", { name: "Delete article" });
  await expect(confirmButton).toBeDisabled();

  await page.getByLabel(/Type .* to confirm/).fill("LS-SH-0000");
  await expect(confirmButton).toBeDisabled();
  await page.getByLabel(/Type .* to confirm/).fill(CLEAN.toLowerCase());
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();

  await expect(page).toHaveURL(/\/admin\/inventory$/);
  await expect(page.getByRole("status").filter({ hasText: `${CLEAN} was deleted` })).toBeVisible();
  expect(await sql(`select 1 from articles where code = $1`, [CLEAN])).toHaveLength(0);
  expect(await sql(`select 1 from variants where sku like $1`, [`${CLEAN}-%`])).toHaveLength(0);
});

test("refuses an article a buyer lead asked about, and offers Archive instead", async ({ page }) => {
  await seed(page, BUSY, "Test Busy Shirt");
  const id = (await sql<{ id: string }>(`select id from articles where code = $1`, [BUSY]))[0].id;
  await sql(`select create_lead($1::jsonb)`, [JSON.stringify({ name: "Ravi", phone: "919800000042", source: "request_price", message: "Need 100", items: [{ article_id: id, quantity: 100 }] })]);

  await page.goto(`admin/inventory/${BUSY}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("heading", { name: "This article can't be deleted" })).toBeVisible();
  await expect(page.getByText(/part of 1 buyer lead/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete article" })).toHaveCount(0);

  await page.getByRole("button", { name: "Archive instead" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Archived" })).toBeVisible();
  const row = (await sql<{ is_active: boolean }>(`select is_active from articles where code = $1`, [BUSY]))[0];
  expect(row.is_active).toBe(false);
});
