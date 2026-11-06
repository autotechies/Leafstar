import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";
import { hasStack, logIn, sql } from "./helpers";

/*
  Add Stock (Step 4), against the real local Supabase stack: new article, duplicate code, draft restore,
  add to existing, Excel import with a bad row then a good file, and the 15-second Undo for each.
  Photo upload itself needs Storage (not part of the local stack); it is covered by the image unit tests.
*/

test.skip(!hasStack, "needs the local Supabase stack (run through scripts/e2e.mjs with DATABASE_URL)");
test.describe.configure({ mode: "serial" });

const stockOf = async (sku: string) => (await sql<{ stock: number }>(`select stock from variants where sku = $1`, [sku]))[0]?.stock;

async function openAddStock(page: Page, tab?: string) {
  await page.goto("admin/stock/add", { waitUntil: "networkidle" });
  if (tab) await page.getByRole("tab", { name: tab }).click();
}

async function fillArticleStep(page: Page, opts: { code?: string; name: string }) {
  await page.getByLabel("Type").selectOption("Shirt");
  if (opts.code) await page.getByLabel("Article code").fill(opts.code);
  else await page.getByRole("button", { name: "Auto" }).click();
  await page.getByLabel("Article name").fill(opts.name);
  await page.getByLabel("Brand").selectOption({ label: "Leaf Star" });
}

test.beforeAll(async () => {
  await sql(`insert into brands (name, is_public) select 'Leaf Star', true where not exists (select 1 from brands where lower(name) = 'leaf star')`);
});

test.beforeEach(async ({ page }) => {
  await logIn(page);
  await expect(page).toHaveURL(/\/admin$/);
});

test("creates a new article with colours and stock, then undoes it within 15 seconds", async ({ page }) => {
  await openAddStock(page);
  await fillArticleStep(page, { name: "Check Shirt" });
  await expect(page.getByLabel("Article code")).toHaveValue(/^LS-SH-\d{4}$/);
  const code = await page.getByLabel("Article code").inputValue();
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByRole("button", { name: "Navy", exact: true }).click();
  await page.getByRole("button", { name: "Sky Blue" }).click();
  await page.getByRole("button", { name: "Next" }).click(); // photos (optional while hidden)
  await page.getByRole("button", { name: "Next" }).click(); // stock
  await page.getByLabel("Navy M pieces").fill("30");
  await page.getByLabel("Navy L pieces").fill("20");
  await page.getByLabel("Sky Blue M pieces").fill("10");
  await expect(page.getByText("Total:")).toContainText("60");
  await page.getByRole("button", { name: "Next" }).click();

  // Cannot be published without a photo.
  await expect(page.getByRole("switch", { name: "Show on the website now" })).toBeDisabled();
  await page.getByRole("button", { name: "Save article" }).click();
  await expect(page.getByRole("status").filter({ hasText: `${code} saved` })).toBeVisible();

  expect(await stockOf(`${code}-NVY-M`)).toBe(30);
  expect(await stockOf(`${code}-NVY-L`)).toBe(20);
  expect(await stockOf(`${code}-SKY-M`)).toBe(10);
  expect((await sql(`select is_public from articles where code = $1`, [code]))[0].is_public).toBe(false);

  await page.getByRole("status").filter({ hasText: `${code} saved` }).getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Undone" })).toBeVisible();
  expect(await stockOf(`${code}-NVY-M`)).toBe(0);
  expect((await sql(`select is_active from articles where code = $1`, [code]))[0].is_active).toBe(false);
});

test("a duplicate article code gives a friendly error and saves nothing", async ({ page }) => {
  const [existing] = await sql<{ code: string }>(`select code from articles order by created_at limit 1`);
  const before = (await sql<{ n: number }>(`select count(*)::int as n from articles`))[0].n;
  await openAddStock(page);
  await fillArticleStep(page, { code: existing.code, name: "Another Shirt" });
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Navy", exact: true }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Save article" }).click();
  await expect(page.getByText("An article with this code already exists")).toBeVisible();
  expect((await sql<{ n: number }>(`select count(*)::int as n from articles`))[0].n).toBe(before);
});

test("the step checks stop an incomplete article, and an unfinished article returns after a reload", async ({ page }) => {
  await openAddStock(page);
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Choose Shirt or Pant")).toBeVisible();
  await expect(page.getByText("Give the article a name")).toBeVisible();

  await page.getByLabel("Article name").fill("Half Done Shirt");
  await page.waitForTimeout(700); // the draft is saved shortly after typing
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByText("Your unfinished article was restored")).toBeVisible();
  await expect(page.getByLabel("Article name")).toHaveValue("Half Done Shirt");
  await page.getByRole("button", { name: "Discard draft" }).click();
  await expect(page.getByLabel("Article name")).toHaveValue("");
});

test("adds production to an existing article and undoes it", async ({ page }) => {
  const code = "LS-SH-7001";
  await sql(`delete from stock_movements where variant_id in (select id from variants where article_id in (select id from articles where code = $1))`, [code]).catch(() => undefined);
  const [{ id: brandId }] = await sql<{ id: string }>(`select id from brands where lower(name) = 'leaf star'`);
  await sql(
    `with a as (insert into articles (code, name, category, garment, brand_id) values ($1, 'Plain Shirt', 'upperwear', 'Shirt', $2) on conflict (code) do nothing returning id),
          c as (insert into article_colors (article_id, name, code, hex, sort_order) select id, 'Navy', 'NVY', '#1F2F54', 0 from a returning id, article_id)
     insert into variants (article_id, color_id, size, size_order, sku) select article_id, id, s, row_number() over (), $1 || '-NVY-' || s from c, unnest(array['M','L']) as s`,
    [code, brandId],
  );
  const before = await stockOf(`${code}-NVY-M`);

  await openAddStock(page, "Add to existing");
  await page.getByLabel("Article").selectOption({ label: `${code} · Plain Shirt` });
  await page.getByLabel(/^M \(now/).fill("40");
  await page.getByLabel(/^L \(now/).fill("12");
  await page.getByRole("button", { name: "Add stock" }).click();
  await expect(page.getByRole("status").filter({ hasText: "52 pieces added" })).toBeVisible();
  expect(await stockOf(`${code}-NVY-M`)).toBe((before ?? 0) + 40);

  await page.getByRole("status").filter({ hasText: "52 pieces added" }).getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Undone" })).toBeVisible();
  expect(await stockOf(`${code}-NVY-M`)).toBe(before ?? 0);
});

async function workbook(rows: Array<Array<string | number>>, name: string) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Stock");
  sheet.addRow(["Article code", "Article name", "Type", "Brand", "Fabric", "Pattern", "Colour", "Colour code", "Colour hex", "Size", "Pieces"]);
  for (const r of rows) sheet.addRow(r);
  return { name, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(await wb.xlsx.writeBuffer()) };
}

test("imports from Excel: a bad row saves nothing, a good file imports, and Undo reverses it", async ({ page }) => {
  await openAddStock(page, "Import from Excel");
  const chooser = page.locator('input[type="file"]');

  const bad = await workbook(
    [
      ["LS-SH-7100", "Import Shirt", "Shirt", "Leaf Star", "Cotton", "Solid", "Navy", "", "", "M", 10],
      ["LS-SH-7100", "Import Shirt", "Shirt", "No Such Brand", "Cotton", "Solid", "Navy", "", "", "L", 10],
      ["LS-XX-7100", "Bad Code", "Shirt", "Leaf Star", "", "", "Navy", "", "", "L", 5],
      ["LS-SH-7101", "Odd Colour", "Shirt", "Leaf Star", "", "", "Teal Green", "", "", "M", 5],
    ],
    "bad.xlsx",
  );
  const before = (await sql<{ n: number }>(`select count(*)::int as n from articles`))[0].n;
  await chooser.setInputFiles(bad);
  await expect(page.getByText("3 rows need fixing")).toBeVisible();
  await expect(page.getByRole("cell", { name: /Brand "No Such Brand" is not in Settings/ })).toBeVisible();
  await expect(page.getByRole("cell", { name: /Article code "LS-XX-7100"/ })).toBeVisible();
  await expect(page.getByRole("cell", { name: /needs a 3-letter code/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Import / })).toHaveCount(0);
  expect((await sql<{ n: number }>(`select count(*)::int as n from articles`))[0].n).toBe(before);

  const good = await workbook(
    [
      ["LS-SH-7100", "Import Shirt", "Shirt", "Leaf Star", "Cotton", "Solid", "Navy", "", "", "M", 10],
      ["LS-SH-7100", "Import Shirt", "Shirt", "Leaf Star", "Cotton", "Solid", "Navy", "", "", "L", 15],
      ["LS-SH-7100", "Import Shirt", "Shirt", "Leaf Star", "Cotton", "Solid", "Teal Green", "TLG", "#1F7A6F", "M", 5],
    ],
    "good.xlsx",
  );
  await chooser.setInputFiles(good);
  await expect(page.getByText("All 3 rows are correct")).toBeVisible();
  await page.getByRole("button", { name: "Import 30 pieces" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Imported 30 pieces" })).toBeVisible();
  expect(await stockOf("LS-SH-7100-NVY-M")).toBe(10);
  expect(await stockOf("LS-SH-7100-TLG-M")).toBe(5);
  expect((await sql(`select is_public from articles where code = 'LS-SH-7100'`))[0].is_public).toBe(false);

  await page.getByRole("status").filter({ hasText: "Imported 30 pieces" }).getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Undone" })).toBeVisible();
  expect(await stockOf("LS-SH-7100-NVY-M")).toBe(0);
});

test("the Excel template downloads for signed-in staff only", async ({ page, browser }) => {
  const ok = await page.request.get("api/stock/template");
  expect(ok.status()).toBe(200);
  expect(ok.headers()["content-type"]).toContain("spreadsheetml");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await ok.body()) as unknown as ArrayBuffer);
  expect(wb.worksheets[0].getRow(1).getCell(1).value).toBe("Article code");

  const anon = await browser.newContext({ baseURL: String(test.info().project.use.baseURL) });
  const denied = await anon.request.get("api/stock/template");
  expect(denied.status()).toBe(401);
  await anon.close();
});

test("the old .xls format is refused with clear instructions", async ({ page }) => {
  await openAddStock(page, "Import from Excel");
  await page.locator('input[type="file"]').setInputFiles({ name: "old.xls", mimeType: "application/vnd.ms-excel", buffer: Buffer.from("not really excel") });
  await expect(page.getByText(/Old \.xls files cannot be read/)).toBeVisible();
});
