import { expect, test } from "@playwright/test";
import { hasStack, logIn, seedPublicArticle, sql } from "./helpers";

/* Dashboard and global search (Step 11): numbers match the pages they link to; SKU search shows stock, movements, bills and leads. */

test.skip(!hasStack, "needs the local Supabase stack (run through scripts/e2e.mjs with DATABASE_URL)");
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await seedPublicArticle();
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page);
  await expect(page).toHaveURL(/\/admin$/);
});

test("the Dashboard numbers match the database, and every tile links into a page", async ({ page }) => {
  const stock = Number((await sql<{ s: string }>(`select coalesce(sum(v.stock), 0) as s from variants v join articles a on a.id = v.article_id where v.is_active and a.is_active`))[0].s);
  const waiting = Number((await sql<{ c: string }>(`select count(*) as c from inbox_open_by_contact`))[0].c);
  const open = Number((await sql<{ c: string }>(`select count(*) as c from leads where stage not in ('won','lost')`))[0].c);
  await page.goto("admin", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Pieces in stock/ })).toContainText(new Intl.NumberFormat("en-IN").format(stock));
  await expect(page.getByRole("link", { name: /Open leads/ })).toContainText(String(open));
  await expect(page.getByRole("region", { name: "Needs attention" }).getByRole("link").first()).toContainText(String(waiting));
  await page.getByRole("link", { name: /Open leads/ }).click();
  await expect(page).toHaveURL(/\/admin\/crm$/);
});

test("the 7, 30 and 90 day buttons change the range", async ({ page }) => {
  await page.goto("admin", { waitUntil: "networkidle" });
  const range = page.getByRole("navigation", { name: "Date range" });
  await expect(range.getByRole("link", { name: "30 days" })).toHaveAttribute("aria-current", "page");
  await range.getByRole("link", { name: "7 days" }).click();
  await expect(page).toHaveURL(/range=7/);
  await expect(range.getByRole("link", { name: "7 days" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(/Pieces sold, 7 days/)).toBeVisible();
  await range.getByRole("link", { name: "90 days" }).click();
  await expect(page.getByText(/Pieces sold, 90 days/)).toBeVisible();
});

test("empty widgets are honest about what is missing", async ({ page }) => {
  await sql(`update inbox_items set status = 'handled', handled_at = now() where status = 'unanswered'`);
  await page.goto("admin", { waitUntil: "networkidle" });
  await expect(page.getByText("Nobody is waiting")).toBeVisible();
});

test("searching a full variant SKU shows its stock, movements, bills and leads", async ({ page }) => {
  const v = (await sql<{ sku: string; id: string; article_id: string }>(`select sku, id, article_id from variants order by sku limit 1`))[0];
  await sql(`delete from leads where phone = '919866600001'`);
  await sql(`select create_lead(jsonb_build_object('name','Sku Searcher','phone','919866600001','source','request_price','items', jsonb_build_array(jsonb_build_object('article_id', '${v.article_id}', 'quantity', 120))))`);
  await page.goto("admin", { waitUntil: "networkidle" });
  await page.getByRole("searchbox", { name: "Search everything" }).fill(v.sku);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/search\?q=/);
  await expect(page.getByRole("heading", { name: v.sku })).toBeVisible();
  await expect(page.getByText("pieces in stock", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Latest movements" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bills with this SKU" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Sku Searcher/ })).toBeVisible();
});

test("search finds buyers by phone and says plainly when nothing matches", async ({ page }) => {
  await page.goto("admin/search?q=98666", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: /Sku Searcher/ })).toBeVisible();
  await page.goto("admin/search?q=zzzznothing", { waitUntil: "networkidle" });
  await expect(page.getByText(/Nothing found for/)).toBeVisible();
  await page.goto("admin/search?q=a", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Search everything" })).toBeVisible();
});

test("on a phone the search icon opens the search page", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("admin", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/admin\/search$/);
  await expect(page.getByRole("searchbox", { name: "Search" })).toBeFocused();
});
