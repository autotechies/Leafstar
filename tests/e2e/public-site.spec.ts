import { expect, test } from "@playwright/test";
import { hasStack, PUBLIC_ARTICLE_CODE, resetRateLimits, seedPublicArticle, sql } from "./helpers";

/*
  The public website (Step 6) against the real local Supabase stack: a buyer finds an article,
  adds it to the enquiry list, sends a request; a repeat phone joins the same lead; callback and contact
  forms land in the Inbox; prices and exact stock never reach the page.
*/

test.skip(!hasStack, "needs the local Supabase stack (run through scripts/e2e.mjs with DATABASE_URL)");
test.describe.configure({ mode: "serial" });

const CODE = PUBLIC_ARTICLE_CODE;

test.beforeAll(async () => {
  await seedPublicArticle();
});

test.beforeEach(async () => {
  await resetRateLimits();
});

test("the catalog shows the article with colours, no price and no exact stock", async ({ page }) => {
  await page.goto("catalog", { waitUntil: "networkidle" });
  const card = page.getByRole("article").filter({ hasText: CODE });
  await expect(card).toBeVisible();
  await expect(card.getByText("Min. 50 pcs")).toBeVisible();
  await expect(card.getByRole("button", { name: "Request price" })).toBeVisible();
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/₹|\bRs\.?\s?\d/);
  expect(text).not.toMatch(/\b90\b/); // 40 + 30 + 20 pieces must never be shown
  // Swatches switch the photo.
  await card.getByRole("button", { name: "Sky Blue" }).click();
  await expect(card.getByRole("button", { name: /View photos of Public Check Shirt in Sky Blue/ })).toBeVisible();
});

test("filters narrow the list and can be cleared", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("catalog", { waitUntil: "networkidle" });
  await page.getByLabel("Search articles").fill("zzzz-no-such");
  await expect(page.getByText("No articles match")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByRole("article").filter({ hasText: CODE })).toBeVisible();
});

test("an article page opens by code and unknown codes show the 404 page", async ({ page }) => {
  await page.goto(`catalog/${CODE}`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: "Public Check Shirt" })).toBeVisible();
  await expect(page.getByText("Any quantity from 50 pieces")).toBeVisible();
  // The page streams, so the status line is already sent; the 404 page itself shows and is kept out of search results.
  await page.goto("catalog/LS-NOPE-0000", { waitUntil: "networkidle" });
  await expect(page.locator('head meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("heading", { name: "We could not find that page" })).toBeVisible();
});

test("Request price from the article page creates one lead with its article and an Inbox item", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`catalog/${CODE}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Request price" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Request price" });
  await dialog.getByLabel("Your name").fill("Meera Traders");
  await dialog.getByLabel("Phone number").fill("98111 22233");
  await dialog.getByLabel("Pieces needed").fill("20");
  await expect(dialog.getByText(/below our minimum of 50/)).toBeVisible();
  await dialog.getByLabel("Pieces needed").fill("120");
  await dialog.getByRole("button", { name: "Send request" }).click();
  await expect(dialog.getByRole("heading", { name: /we have your request/ })).toBeVisible();
  await expect(dialog.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", /^https:\/\/wa\.me\/919876543210\?text=/);

  const leads = await sql<{ id: string; phone: string; source: string; stage: string }>(`select id, phone, source, stage from leads where phone = '919811122233'`);
  expect(leads).toHaveLength(1);
  expect(leads[0]).toMatchObject({ source: "request_price", stage: "new" });
  expect((await sql(`select 1 from lead_items where lead_id = $1`, [leads[0].id]))).toHaveLength(1);
  expect((await sql(`select 1 from inbox_items where lead_id = $1 and kind = 'request_price' and status = 'unanswered'`, [leads[0].id]))).toHaveLength(1);
});

test("the enquiry list keeps articles, then sends ONE request that joins the buyer's open lead", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("catalog", { waitUntil: "networkidle" });
  const card = page.getByRole("article").filter({ hasText: CODE });
  await card.getByRole("button", { name: /Add Public Check Shirt to enquiry list/ }).click();
  await expect(page.getByRole("link", { name: /Enquiry list, 1 article/ })).toBeVisible();

  await page.goto("enquiry", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Public Check Shirt" })).toBeVisible();
  await page.getByLabel("Pieces needed").fill("60");
  await page.getByLabel("Your name").fill("Meera Traders");
  await page.getByLabel("Phone number").fill("9811122233");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByRole("heading", { name: /we have your request/ })).toBeVisible();

  expect(await sql(`select 1 from leads where phone = '919811122233'`)).toHaveLength(1); // joined, not duplicated
  expect((await sql<{ n: number }>(`select count(*)::int as n from inbox_items where phone = '919811122233'`))[0].n).toBe(2);
  // The list is emptied once sent.
  await page.goto("enquiry", { waitUntil: "networkidle" });
  await expect(page.getByText("Your enquiry list is empty")).toBeVisible();
});

test("the call sheet logs a tap and takes a callback request", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("contact", { waitUntil: "networkidle" });
  await page.getByRole("banner").getByRole("button", { name: "Call us" }).click();
  const dialog = page.getByRole("dialog", { name: "Call Leaf Star" });
  await expect(dialog.getByRole("link", { name: /\+91 98765 43210/ })).toHaveAttribute("href", "tel:+919876543210");
  const before = (await sql<{ n: number }>(`select count(*)::int as n from inbox_items where kind = 'call_tap'`))[0].n;
  // Tapping the number logs a tap (stop the browser from actually dialling).
  await dialog.getByRole("link", { name: /\+91 98765 43210/ }).evaluate((a) => a.addEventListener("click", (e) => e.preventDefault()));
  await dialog.getByRole("link", { name: /\+91 98765 43210/ }).click();
  await expect.poll(async () => (await sql<{ n: number }>(`select count(*)::int as n from inbox_items where kind = 'call_tap'`))[0].n).toBe(before + 1);

  await dialog.getByLabel("Your name").fill("Asha");
  await dialog.getByLabel("Phone number").fill("9822233344");
  await dialog.getByRole("button", { name: "Request a callback" }).click();
  await expect(dialog.getByText("Thank you. We will call you back.")).toBeVisible();
  expect(await sql(`select 1 from inbox_items where phone = '919822233344' and kind = 'callback_request'`)).toHaveLength(1);
});

test("the contact form creates a lead and an Inbox item, and bad input is explained", async ({ page }) => {
  await page.goto("contact", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Enter your name")).toBeVisible();
  await expect(page.getByText("Enter a phone number with 10 digits")).toBeVisible();
  await page.getByLabel("Your name").fill("Ravi");
  await page.getByLabel("Phone number").fill("9833344455");
  await page.getByLabel("How can we help?").fill("Do you make half-sleeve shirts in bulk?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("heading", { name: /we have your message/ })).toBeVisible();
  expect(await sql(`select 1 from inbox_items where phone = '919833344455' and kind = 'contact_form'`)).toHaveLength(1);
});

test("the public routes refuse other sites and bots, and rate limit repeats", async ({ request }) => {
  const body = { name: "X Y", phone: "9844455566", message: "hello there", website: "" };
  const noOrigin = await request.post("api/contact", { data: body });
  expect(noOrigin.status()).toBe(403);
  const wrongOrigin = await request.post("api/contact", { data: body, headers: { origin: "https://evil.example" } });
  expect(wrongOrigin.status()).toBe(403);

  const origin = new URL(process.env.PW_BASE_URL ?? "http://127.0.0.1:3100").origin;
  const bot = await request.post("api/contact", { data: { ...body, website: "http://spam" }, headers: { origin } });
  expect(bot.status()).toBe(200);
  expect(await sql(`select 1 from leads where phone = '919844455566'`)).toHaveLength(0); // pretended, saved nothing

  let last = 0;
  for (let i = 0; i < 8; i++) last = (await request.post("api/contact", { data: body, headers: { origin } })).status();
  expect(last).toBe(429);
});

test("the enquiry route needs at least one article", async ({ request }) => {
  const origin = new URL(process.env.PW_BASE_URL ?? "http://127.0.0.1:3100").origin;
  const res = await request.post("api/enquiry", { data: { name: "Ab", phone: "9855566677", items: [] }, headers: { origin } });
  expect(res.status()).toBe(400);
});
