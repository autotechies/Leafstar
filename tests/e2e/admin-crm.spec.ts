import { expect, test } from "@playwright/test";
import { hasStack, logIn, sql } from "./helpers";

/* CRM (Step 10): board, drawer, follow-ups, Lost reason, Won creates a buyer, buyers directory. */

test.skip(!hasStack, "needs the local Supabase stack (run through scripts/e2e.mjs with DATABASE_URL)");
test.describe.configure({ mode: "serial" });

const PHONE = "919855500001";

test.beforeAll(async () => {
  await sql(`delete from leads where phone in ('${PHONE}', '919855500002')`);
  await sql(`delete from contacts where phone in ('${PHONE}', '919855500002')`);
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page);
  await expect(page).toHaveURL(/\/admin$/);
});

const column = (page: import("@playwright/test").Page, name: string) => page.getByRole("region", { name: `${name} leads` });

test("add a lead by hand; it lands in New and a repeat phone opens the same lead", async ({ page }) => {
  await page.goto("admin/crm", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Add a lead" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a lead" });
  await dialog.getByLabel(/^Name/).fill("Board Buyer");
  await dialog.getByLabel(/^Phone/).fill("98555 00001");
  await dialog.getByLabel("Business name (optional)").fill("Board Traders");
  await dialog.getByRole("button", { name: "Add lead" }).click();
  await expect(page.getByRole("dialog", { name: "Board Buyer" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(column(page, "New").getByRole("button", { name: /Board Buyer/ })).toBeVisible();
  expect(await sql(`select 1 from leads where phone = '${PHONE}' and source = 'manual'`)).toHaveLength(1);

  await page.getByRole("link", { name: "Add a lead" }).click();
  const again = page.getByRole("dialog", { name: "Add a lead" });
  await again.getByLabel(/^Name/).fill("Board Buyer");
  await again.getByLabel(/^Phone/).fill(PHONE);
  await again.getByRole("button", { name: "Add lead" }).click();
  await expect(page.getByText("already has an open lead").first()).toBeVisible();
  expect(await sql(`select 1 from leads where phone = '${PHONE}'`)).toHaveLength(1);
});

test("drag through the stages; Lost asks for a reason and Cancel leaves it where it was", async ({ page }) => {
  await page.goto("admin/crm", { waitUntil: "networkidle" });
  const card = () => page.getByRole("listitem").filter({ hasText: "Board Buyer" });
  await card().dragTo(column(page, "Contacted"));
  await expect(column(page, "Contacted").getByRole("button", { name: /Board Buyer/ })).toBeVisible();
  await column(page, "Contacted").getByRole("listitem").filter({ hasText: "Board Buyer" }).dragTo(column(page, "Quoted"));
  await expect(column(page, "Quoted").getByRole("button", { name: /Board Buyer/ })).toBeVisible();

  // Lost is the seventh column, off-screen on a laptop, so the card's stage menu is the way there.
  await column(page, "Quoted").getByLabel("Stage for Board Buyer").selectOption("lost");
  const dialog = page.getByRole("dialog", { name: "Why was this lead lost?" });
  await expect(dialog.getByRole("button", { name: "Mark as lost" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  expect((await sql<{ stage: string }>(`select stage from leads where phone = '${PHONE}'`))[0].stage).toBe("quoted");

  const stages = (await sql<{ body: string }>(`select body from lead_activities a join leads l on l.id = a.lead_id where l.phone = '${PHONE}' and a.kind = 'stage_change' order by a.created_at`)).map((r) => r.body);
  expect(stages).toEqual(["new to contacted", "contacted to quoted"]);
});

test("drawer: follow-up in the past is overdue, notes join the timeline, amount is saved", async ({ page }) => {
  await page.goto("admin/crm", { waitUntil: "networkidle" });
  await column(page, "Quoted").getByRole("button", { name: /Board Buyer/ }).click();
  const drawer = page.getByRole("dialog", { name: "Board Buyer" });
  await expect(drawer.getByRole("link", { name: "+91 98555 00001" })).toHaveAttribute("href", `tel:+${PHONE}`);
  await drawer.getByLabel("Quoted amount (₹)").fill("45000");
  await drawer.getByLabel("Follow up on").fill("2020-01-01");
  await drawer.getByRole("button", { name: "Save amount and date" }).click();
  await expect(drawer.getByText("Follow-up overdue")).toBeVisible();
  await drawer.getByLabel("What happened").fill("Called, will decide by Friday");
  await drawer.getByRole("button", { name: "Add to timeline" }).click();
  await expect(drawer.getByText("Called, will decide by Friday")).toBeVisible();
  const row = (await sql<{ quoted_amount: string; next_follow_up: Date }>(`select quoted_amount, next_follow_up from leads where phone = '${PHONE}'`))[0];
  expect(Number(row.quoted_amount)).toBe(45000);
  await page.keyboard.press("Escape");
  await expect(column(page, "Quoted").getByText("Follow-up overdue")).toBeVisible();
});

test("Won creates a buyer who appears in the directory; a stale change is refused", async ({ page }) => {
  await page.goto("admin/crm", { waitUntil: "networkidle" });
  await column(page, "Quoted").getByLabel("Stage for Board Buyer").selectOption("won");
  await expect(column(page, "Won").getByRole("button", { name: /Board Buyer/ })).toBeVisible();
  const contact = await sql<{ name: string; roles: string[] }>(`select name, roles from contacts where phone = '${PHONE}'`);
  expect(contact).toHaveLength(1);
  expect(contact[0].roles).toContain("buyer");

  await page.goto("admin/crm/buyers", { waitUntil: "networkidle" });
  await page.getByRole("table").getByRole("button", { name: /Board Buyer/ }).click();
  const drawer = page.getByRole("dialog", { name: "Board Buyer" });
  await drawer.getByLabel("GSTIN").fill("NOT-A-GSTIN");
  await drawer.getByRole("button", { name: "Save buyer" }).click();
  await expect(drawer.getByText(/GSTIN does not look right/)).toBeVisible();
  await drawer.getByLabel("GSTIN").fill("24ABCDE1234F1Z5");
  await drawer.getByLabel("Payment terms (days)").fill("30");
  await drawer.getByRole("button", { name: "Save buyer" }).click();
  await expect.poll(async () => (await sql<{ payment_terms_days: number }>(`select payment_terms_days from contacts where phone = '${PHONE}'`))[0].payment_terms_days).toBe(30);
});

test("a stale move is refused instead of overwriting someone else's change", async ({ page }) => {
  await sql(`select create_lead('{"name":"Stale Buyer","phone":"919855500002","source":"contact_form","message":"hi"}'::jsonb)`);
  await page.goto("admin/crm", { waitUntil: "networkidle" });
  await sql(`update leads set stage = 'contacted' where phone = '919855500002'`);
  await column(page, "New").getByRole("listitem").filter({ hasText: "Stale Buyer" }).dragTo(column(page, "Quoted"));
  await expect(page.getByText(/changed by someone else/)).toBeVisible();
  expect((await sql<{ stage: string }>(`select stage from leads where phone = '919855500002'`))[0].stage).toBe("contacted");
});

test("on a phone each card has a Stage menu and the stages are tabs", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("admin/crm", { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /Contacted/ }).click();
  const stale = page.getByRole("listitem").filter({ hasText: "Stale Buyer" });
  await stale.getByLabel("Stage for Stale Buyer").selectOption("negotiation");
  await expect.poll(async () => (await sql<{ stage: string }>(`select stage from leads where phone = '919855500002'`))[0].stage).toBe("negotiation");
});
