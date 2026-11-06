import { expect, test } from "@playwright/test";

/* The viewer with real touch input, on a phone-sized touch device (project "phone" in playwright.config.ts). */

const lab = "dev/image-lab";
const dialog = (page: import("@playwright/test").Page) => page.getByRole("dialog");

test("tap opens the viewer, swipe changes photo, double-tap zooms, Back closes", async ({ page }) => {
  await page.goto(lab, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Open Navy test pattern" }).first().tap();
  const viewer = dialog(page);
  await expect(viewer).toBeVisible();
  await expect(viewer.getByText("1 / 4")).toBeVisible();

  // Swipe left with a real touch drag.
  const box = (await viewer.locator(".yarl__slide_current").first().boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const y = box.y + box.height / 2;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + box.width * 0.8, y }] });
  for (let i = 1; i <= 8; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box.x + box.width * (0.8 - i * 0.08), y }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(viewer.getByText("2 / 4")).toBeVisible();

  // Double-tap zooms in.
  const img = viewer.locator(".yarl__slide_current img").first();
  const before = (await img.boundingBox())!.width;
  const cx = box.x + box.width / 2;
  for (let n = 0; n < 2; n++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx, y }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(60);
  }
  await expect.poll(async () => (await img.boundingBox())!.width).toBeGreaterThan(before * 1.4);

  await page.goBack();
  await expect(viewer).toBeHidden();
});
