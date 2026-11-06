import { expect, test } from "@playwright/test";

/*
  The shared photo viewer and photo loading (Step 3). Smoothness on a real phone is judged by the owner
  (BUILD_PLAN.md); these tests prove the behaviour that makes it work: viewer opens, zooms, swipes,
  closes with Escape and with the browser's Back, locks the page behind it, and swatches switch photos.
*/

const lab = "dev/image-lab";
const dialog = (page: import("@playwright/test").Page) => page.getByRole("dialog");

test("a colour dot switches the photo at once, with no blank gap", async ({ page }) => {
  await page.goto(lab, { waitUntil: "networkidle" });
  const card = page.locator("section").first();
  const hero = card.locator("img").first();
  await expect(hero).toHaveAttribute("alt", "Navy test pattern");
  // Everything is preloaded, so after the click the new photo is already complete in the cache.
  await card.getByRole("button", { name: "Olive", exact: true }).click();
  await expect(hero).toHaveAttribute("alt", "Olive test pattern");
  await expect(hero).toHaveJSProperty("complete", true);
  await card.getByRole("button", { name: "Maroon", exact: true }).click();
  await expect(card.getByRole("button", { name: "Maroon", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("a photo shows a blur first, reserves its space, and offers three sizes", async ({ page }) => {
  await page.goto(lab, { waitUntil: "networkidle" });
  const img = page.locator("section").first().locator("img").first();
  await expect(img).toHaveAttribute("width", "1600");
  await expect(img).toHaveAttribute("height", "2000");
  expect(await img.getAttribute("srcset")).toMatch(/thumb[\s\S]*320w[\s\S]*medium[\s\S]*800w[\s\S]*large[\s\S]*2000w/);
  const frame = img.locator("xpath=..");
  expect(await frame.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain("data:image/webp");
});

test("the viewer opens, shows a counter and thumbnails, and moves between photos", async ({ page }) => {
  await page.goto(lab, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Open Navy test pattern" }).first().click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByText("1 / 4")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(dialog(page).getByText("2 / 4")).toBeVisible();
  await dialog(page).getByRole("button", { name: "Next photo" }).click();
  await expect(dialog(page).getByText("3 / 4")).toBeVisible();
  await dialog(page).getByRole("button", { name: "Previous photo" }).click();
  await expect(dialog(page).getByText("2 / 4")).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "Zoom in" })).toBeVisible();
});

test("zoom in and out work, and the page behind cannot scroll", async ({ page }) => {
  await page.goto(lab, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Open Navy test pattern" }).first().click();
  const viewer = dialog(page);
  await expect(viewer).toBeVisible();
  const slideImage = viewer.locator(".yarl__slide_current img").first();
  const before = await slideImage.boundingBox();
  await viewer.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(async () => (await slideImage.boundingBox())!.width).toBeGreaterThan(before!.width * 1.4);
  await viewer.getByRole("button", { name: "Zoom out" }).click();
  await expect.poll(async () => Math.round((await slideImage.boundingBox())!.width)).toBeLessThanOrEqual(Math.round(before!.width) + 2);
  // The page behind must not move when scrolled with the viewer open.
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.move(10, 10);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe("hidden");
});

test("Escape closes the viewer and gives the page back", async ({ page }) => {
  await page.goto(lab, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Open Navy test pattern" }).first().click();
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
  // Closing from the screen must not leave an extra history entry behind.
  const length = await page.evaluate(() => window.history.length);
  await page.getByRole("button", { name: "Open Navy test pattern" }).first().click();
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.history.length)).toBeLessThanOrEqual(length + 1);
});

test("the browser's Back (the phone's back gesture) closes the viewer and stays on the page", async ({ page }) => {
  await page.goto(lab, { waitUntil: "networkidle" });
  const url = page.url();
  await page.getByRole("button", { name: "Open Navy test pattern" }).first().click();
  await expect(dialog(page)).toBeVisible();
  await page.goBack();
  await expect(dialog(page)).toBeHidden();
  expect(page.url()).toBe(url);
  // Open again: still works after a Back close.
  await page.getByRole("button", { name: "Open Olive test pattern" }).first().click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByText("2 / 4")).toBeVisible();
});
