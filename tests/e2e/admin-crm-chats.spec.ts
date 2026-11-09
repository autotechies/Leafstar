import { expect, test } from "@playwright/test";
import { hasStack, logIn, sql } from "./helpers";

/* Chats (owner side): a returning visitor is ONE entry with every visit in order, and a visitor who shared a phone number is joined to their lead. */

test.skip(!hasStack, "needs the local Supabase stack (run through scripts/e2e.mjs with DATABASE_URL)");

const VISITOR = "7a1f0c52-3b9d-4a26-9d11-0c5e1b7a9e01";
const PHONE = "919900011122";

test.beforeAll(async () => {
  await sql(`delete from visitors where id = $1`, [VISITOR]);
  await sql(`delete from leads where phone = $1`, [PHONE]);
  await sql(`insert into visitors (id, name, phone) values ($1, 'Kiran Textiles', $2)`, [VISITOR, PHONE]);
  const s1 = (await sql<{ id: string }>(`insert into chat_sessions (visitor_id, started_at) values ($1, now() - interval '5 days') returning id`, [VISITOR]))[0].id;
  const s2 = (await sql<{ id: string }>(`insert into chat_sessions (visitor_id, started_at) values ($1, now() - interval '1 hour') returning id`, [VISITOR]))[0].id;
  await sql(`insert into chat_messages (session_id, visitor_id, role, content, created_at) values
    ($1, $3, 'user', 'Do you make formal shirts?', now() - interval '5 days'),
    ($1, $3, 'assistant', 'Yes, we make formal shirts in lots.', now() - interval '5 days' + interval '5 seconds'),
    ($2, $3, 'user', 'I am back, please call me on 99000 11122', now() - interval '1 hour'),
    ($2, $3, 'assistant', 'Thank you, the owner will call you.', now() - interval '1 hour' + interval '5 seconds')`, [s1, s2, VISITOR]);
  await sql(`insert into leads (name, phone, source, stage) values ('Kiran Textiles', $1, 'chatbot', 'new')`, [PHONE]);
});

test("a returning visitor is one entry with a clear history, joined to their lead", async ({ page }) => {
  await logIn(page);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("admin/chats", { waitUntil: "networkidle" });
  const rows = page.getByRole("row").filter({ hasText: "Kiran Textiles" });
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Shared contact");
  await rows.first().getByRole("button", { name: "Kiran Textiles" }).click();

  const dialog = page.getByRole("dialog", { name: "Kiran Textiles" });
  await expect(dialog).toContainText("2 visits");
  await expect(dialog.getByText("Came back after 5 days")).toBeVisible();
  await expect(dialog.getByText("Today", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Do you make formal shirts?")).toBeVisible();
  await expect(dialog.getByText(/I am back, please call me/)).toBeVisible();
  await expect(dialog.getByRole("link", { name: /Open lead/ })).toHaveAttribute("href", /\/admin\/crm\/[0-9a-f-]{36}$/);
  await dialog.getByRole("link", { name: /Open lead/ }).click();

  // The lead shows the same chat, so the owner sees who this is before calling.
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("region", { name: "Website chat" })).toContainText("Do you make formal shirts?");
});
