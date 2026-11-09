import { expect, test } from "@playwright/test";
import { hasStack, logIn, sql } from "./helpers";

/* The owner's assistant: a counted briefing since the last "Mark as seen", an honest message when the AI is off, and no access when signed out. */

test.skip(!hasStack, "needs the local Supabase stack (run through scripts/e2e.mjs with DATABASE_URL)");
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await sql(`update profiles set last_briefed_at = now() - interval '2 days'`);
  await sql(`delete from leads where phone in ('919700000001','919700000002')`);
  await sql(`insert into leads (name, phone, source, stage) values ('Asha Garments', '919700000001', 'contact_form', 'new'), ('Bhanu Traders', '919700000002', 'request_price', 'new')`);
  await sql(`insert into inbox_items (kind, name, phone, preview) values ('callback_request', 'Asha Garments', '919700000001', 'Please call me back')`);
});

test("the briefing counts what is new, and Mark as seen clears it", async ({ page }) => {
  await logIn(page);
  await expect(page).toHaveURL(/\/admin$/);
  const open = page.getByRole("button", { name: /Open the assistant/ });
  await expect(open).toHaveAccessibleName(/new/);
  await open.click();
  const drawer = page.getByRole("dialog", { name: "Leaf Star assistant" });
  await expect(drawer.getByText("Since", { exact: false }).first()).toBeVisible();
  const crm = drawer.getByRole("region", { name: "CRM" });
  await expect(crm).toContainText(/\d+ new leads/);
  await expect(crm).toContainText("Asha Garments");
  await expect(drawer.getByRole("region", { name: "Inbox" })).toContainText(/new messages? or call requests?/);

  await drawer.getByRole("button", { name: "Mark as seen" }).click();
  await expect(drawer.getByText(/Nothing new since then|Everything is quiet/)).toBeVisible();
  expect((await sql<{ n: number }>(`select count(*)::int as n from profiles where last_briefed_at > now() - interval '1 minute'`))[0].n).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open the assistant", exact: true })).toBeVisible();
});

test("asking works, and says so honestly when the AI is not available", async ({ page }) => {
  await logIn(page);
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("button", { name: /Open the assistant/ }).click();
  const drawer = page.getByRole("dialog", { name: "Leaf Star assistant" });
  await drawer.getByRole("tab", { name: "Ask" }).click();
  await drawer.getByRole("button", { name: "What needs my attention?" }).click();
  await expect(drawer.getByText(/I can't think right now/)).toBeVisible();
});

test("signed-out visitors cannot reach the assistant or the admin", async ({ page }) => {
  await page.goto("admin/chats");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto("");
  await expect(page.getByRole("button", { name: /Open the assistant/ })).toHaveCount(0);
});
