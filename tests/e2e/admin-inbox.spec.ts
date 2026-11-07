import { expect, test } from "@playwright/test";
import { hasStack, logIn, sql } from "./helpers";

/* Owner Inbox (Step 9) and Chats (Step 8, owner side) against the real local Supabase stack. */

test.skip(!hasStack, "needs the local Supabase stack (run through scripts/e2e.mjs with DATABASE_URL)");
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await sql(`update inbox_items set status = 'handled', handled_at = now() where status = 'unanswered'`);
  await sql(`select create_lead('{"name":"Inbox Buyer","phone":"919822200011","source":"request_price","message":"Need 100 shirts"}'::jsonb)`);
  await sql(`select create_lead('{"name":"Inbox Buyer","phone":"919822200011","source":"call_click","message":"Call me back"}'::jsonb)`);
  await sql(`insert into inbox_items (kind, preview) values ('call_tap', 'Tapped the Call button on the website')`);
});

test.beforeEach(async ({ page }) => {
  await logIn(page);
  await expect(page).toHaveURL(/\/admin$/);
});

test("requests from one phone are one card; handling it moves it to Handled", async ({ page }) => {
  await page.goto("admin/inbox", { waitUntil: "networkidle" });
  const card = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Inbox Buyer" }) });
  await expect(card).toBeVisible();
  await expect(card.getByText("2 requests")).toBeVisible();
  await expect(card.getByText("+91 98222 00011")).toBeVisible();
  await expect(card.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+919822200011");
  await expect(card.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /wa\.me\/919822200011/);
  await expect(page.getByText("Tapped Call").first()).toBeVisible();

  await card.getByRole("button", { name: "Mark as handled" }).click();
  const dialog = page.getByRole("dialog", { name: "Mark as handled" });
  await dialog.getByRole("button", { name: "WhatsApp" }).click();
  await dialog.getByLabel("Note (optional)").fill("Sent the catalogue");
  await dialog.getByRole("button", { name: "Mark as handled" }).click();
  await expect(card).toBeHidden();
  expect(await sql(`select 1 from inbox_items where phone = '919822200011' and status = 'unanswered'`)).toHaveLength(0);
  const done = await sql<{ handled_via: string; handled_note: string }>(`select handled_via, handled_note from inbox_items where phone = '919822200011' limit 1`);
  expect(done[0]).toEqual({ handled_via: "whatsapp", handled_note: "Sent the catalogue" });

  await page.getByRole("tab", { name: /Handled/ }).click();
  await expect(page.getByText("Sent the catalogue").first()).toBeVisible();
});

test("a person who left no number can be dismissed", async ({ page }) => {
  await page.goto("admin/inbox", { waitUntil: "networkidle" });
  const card = page.getByRole("listitem").filter({ hasText: "Left no phone number" }).first();
  await expect(card.getByRole("link", { name: "Call" })).toHaveCount(0);
  await card.getByRole("button", { name: "Not needed" }).click();
  await expect.poll(async () => (await sql(`select 1 from inbox_items where status = 'unanswered'`)).length).toBe(0);
  await expect(page.getByText("Nobody is waiting")).toBeVisible();
});

test("the nav badge counts people waiting", async ({ page }) => {
  await sql(`select create_lead('{"name":"Badge Buyer","phone":"919822200022","source":"contact_form","message":"Hello"}'::jsonb)`);
  await page.goto("admin", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: /Inbox/ }).first()).toContainText("1");
});

test("Chats: add an answer for the assistant, then edit and delete it", async ({ page }) => {
  await sql(`delete from faq_entries where question = 'Do you give credit to new buyers?'`);
  await page.goto("admin/chats", { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /Your answers/ }).click();
  await page.getByRole("button", { name: "Add an answer" }).click();
  const dialog = page.getByRole("dialog", { name: "Add an answer" });
  await dialog.getByLabel("Question buyers ask").fill("Do you give credit to new buyers?");
  await dialog.getByLabel("Your answer").fill("Credit is for known buyers. New buyers pay in advance for the first lot.");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("table").getByText("Do you give credit to new buyers?")).toBeVisible();
  expect(await sql(`select 1 from faq_entries where question = 'Do you give credit to new buyers?' and is_active`)).toHaveLength(1);

  await page.getByRole("row", { name: /Do you give credit/ }).getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog", { name: "Delete this answer?" }).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("table").getByText("Do you give credit to new buyers?")).toHaveCount(0);
});
