import { expect, test } from "@playwright/test";
import { hasStack, PUBLIC_ARTICLE_CODE, resetRateLimits, seedPublicArticle, sql } from "./helpers";

/*
  The website assistant (Step 8). The local stack has no Gemini key, so these tests cover everything around the model:
  the panel, the honest fallback when the AI is unavailable, the unanswered-question log, a typed phone number becoming one
  lead, and "Forget me" deleting what is stored. The model's own answers are covered by the 50-question run.
*/

test.skip(!hasStack, "needs the local Supabase stack (run through scripts/e2e.mjs with DATABASE_URL)");
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await seedPublicArticle();
});
test.beforeEach(async () => {
  await resetRateLimits();
});

test("chat opens, says so honestly when the assistant is unavailable, and logs the question", async ({ page }) => {
  await page.goto("", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Chat with our assistant" }).click();
  const panel = page.getByRole("dialog", { name: "Ask Leaf Star" });
  await expect(panel).toBeVisible();
  await expect(panel.getByText("I can show you our shirts and pants")).toBeVisible();
  await panel.getByLabel("Your message").fill("What sizes do your shirts come in?");
  await panel.getByRole("button", { name: "Send message" }).click();
  await expect(panel.getByText(/assistant is resting|could not answer/i)).toBeVisible();
  const asked = await sql(`select 1 from unanswered_questions where question = 'What sizes do your shirts come in?'`);
  expect(asked.length).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});

test("Inquire with AI opens the chat for that article and a typed phone number becomes one lead", async ({ page }) => {
  await page.goto(`catalog/${PUBLIC_ARTICLE_CODE}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Inquire with AI" }).first().click();
  const panel = page.getByRole("dialog", { name: "Ask Leaf Star" });
  await expect(panel).toBeVisible();
  await panel.getByLabel("Your message").fill("Please call me on 98111 55566 about this shirt");
  await panel.getByRole("button", { name: "Send message" }).click();
  await expect(panel.getByText(/Please call me on/)).toBeVisible();
  await expect.poll(async () => (await sql(`select 1 from leads where phone = '919811155566' and source = 'chatbot'`)).length).toBe(1);
  const items = await sql(`select 1 from lead_items li join leads l on l.id = li.lead_id join articles a on a.id = li.article_id where l.phone = '919811155566' and a.code = $1`, [PUBLIC_ARTICLE_CODE]);
  expect(items).toHaveLength(1);
  expect((await sql(`select 1 from inbox_items where kind = 'chat' and status = 'unanswered'`)).length).toBeGreaterThan(0);
});

test("Forget me deletes the visitor and their chats", async ({ page }) => {
  await page.goto("", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Chat with our assistant" }).click();
  const panel = page.getByRole("dialog", { name: "Ask Leaf Star" });
  await panel.getByLabel("Your message").fill("Do you make pants?");
  await panel.getByRole("button", { name: "Send message" }).click();
  await expect(panel.getByText(/assistant is resting|could not answer|pants/i).first()).toBeVisible();
  const id = await page.evaluate(() => window.localStorage.getItem("ls-visitor-v1"));
  expect(id).toBeTruthy();
  expect(await sql(`select 1 from visitors where id = $1`, [id])).toHaveLength(1);
  await panel.getByRole("button", { name: "Forget me" }).click();
  await expect(panel.getByRole("status")).toContainText("deleted");
  expect(await sql(`select 1 from visitors where id = $1`, [id])).toHaveLength(0);
  expect(await sql(`select 1 from chat_messages where visitor_id = $1`, [id])).toHaveLength(0);
});

test("on a phone the chat button does not cover the article bar", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto(`catalog/${PUBLIC_ARTICLE_CODE}`, { waitUntil: "networkidle" });
  const fab = await page.getByRole("button", { name: "Chat with our assistant" }).boundingBox();
  const bar = await page.locator("#article-bar").boundingBox();
  expect(fab && bar).toBeTruthy();
  expect((fab as { y: number; height: number }).y + (fab as { y: number; height: number }).height).toBeLessThanOrEqual((bar as { y: number }).y);
});

test("a reply shows as bullets with article cards and tappable chips; a chip sends its words", async ({ page }) => {
  const sent: string[] = [];
  await page.route("**/api/chat", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as { message: string };
    sent.push(body.message);
    await route.fulfill({
      json: {
        ok: true, sessionId: null, needsOwner: false, fallback: false, leadSaved: false, similar: false,
        reply: sent.length === 1 ? "Here are our shirts:\n- **Premium Shirt** is our everyday pick\n- Sold in lots from **50 pieces**\n\nWhich sizes do you need?" : "Sure. Share your name and phone number and the owner will call you.",
        products: sent.length === 1 ? [{ code: "LS-SH-0001", name: "Premium Shirt", garment: "Shirt", thumb: null, colours: [{ name: "Navy", hex: "#1C2B4A" }, { name: "Grey", hex: "#888888" }], sizes: ["M", "L", "XL"], moq: 50, lowStock: true }] : [],
        quickReplies: sent.length === 1 ? ["Sizes M to XL", "Request a price"] : [],
      },
    });
  });
  await page.goto("", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Chat with our assistant" }).click();
  const panel = page.getByRole("dialog", { name: "Ask Leaf Star" });
  await expect(panel.getByRole("button", { name: "Show me shirts" })).toBeVisible();
  await panel.getByRole("button", { name: "Show me shirts" }).click();

  const bullets = panel.locator("ul.list-disc > li");
  await expect(bullets).toHaveCount(2);
  await expect(bullets.nth(1)).toHaveText("Sold in lots from 50 pieces");
  await expect(bullets.nth(0).locator("strong")).toHaveText("Premium Shirt");
  const card = panel.getByRole("link", { name: /Premium Shirt/ });
  await expect(card).toContainText("LS-SH-0001");
  await expect(card).toContainText("Sizes M, L, XL · Min 50 pcs · limited stock");
  await expect(card).toHaveAttribute("href", "/catalog/LS-SH-0001");
  await expect(card.getByRole("img", { name: "Colours: Navy, Grey" })).toBeVisible();
  // Chips are only under the latest reply; the greeting's chips are gone.
  await expect(panel.getByRole("button", { name: "Show me pants" })).toHaveCount(0);
  await panel.getByRole("button", { name: "Request a price" }).click();
  await expect(panel.getByText("Share your name and phone number")).toBeVisible();
  expect(sent).toEqual(["Show me shirts", "Request a price"]);
  await expect(panel.getByRole("button", { name: "Request a price" })).toHaveCount(0);
});
