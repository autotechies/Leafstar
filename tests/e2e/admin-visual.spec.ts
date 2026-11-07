import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { hasStack, logIn } from "./helpers";
import { themes, widths } from "./pages";

/*
  Admin pages behind login: screenshot at 4 widths × 2 themes, no sideways scroll, zero accessibility
  violations. Runs after admin-flows (see playwright.config.ts), so the account is back to normal.
*/

test.skip(!hasStack, "needs the local Supabase stack (run through scripts/e2e.mjs with DATABASE_URL)");

const adminPages = [
  { name: "admin-login", path: "admin/login", signedIn: false },
  { name: "admin-forgot-password", path: "admin/forgot-password", signedIn: false },
  { name: "admin-dashboard", path: "admin", signedIn: true },
  { name: "admin-settings", path: "admin/settings", signedIn: true },
  { name: "admin-add-stock", path: "admin/stock/add", signedIn: true },
  { name: "admin-inventory", path: "admin/inventory", signedIn: true },
  { name: "admin-inbox", path: "admin/inbox", signedIn: true },
  { name: "admin-crm", path: "admin/crm", signedIn: true },
  { name: "admin-buyers", path: "admin/crm/buyers", signedIn: true },
  { name: "admin-chats", path: "admin/chats", signedIn: true },
  { name: "admin-bills", path: "admin/bills", signedIn: true },
  { name: "admin-scan-bills", path: "admin/bills/scan", signedIn: true },
  { name: "admin-search", path: "admin/search?q=ls", signedIn: true },
] as const;

for (const p of adminPages) {
  for (const theme of themes) {
    for (const w of widths) {
      test(`${p.name} · ${theme} · ${w.name}px`, async ({ page }) => {
        await page.context().addCookies([{ name: "ls-theme", value: theme, url: String(test.info().project.use.baseURL) }]);
        await page.setViewportSize({ width: w.width, height: w.height });
        if (p.signedIn) {
          await logIn(page);
          await expect(page).toHaveURL(/\/admin$/);
        }
        await page.goto(p.path, { waitUntil: "networkidle" });
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await page.evaluate(() => document.fonts.ready);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, "page must not scroll sideways").toBeLessThanOrEqual(0);
        await page.screenshot({ path: `screenshots/${p.name}-${theme}-${w.name}.png`, fullPage: true, animations: "disabled" });

        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
        expect(summary, "accessibility violations").toEqual([]);
      });
    }
  }
}

test("phone menu opens with every section and closes again", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await logIn(page);
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("dialog", { name: "Admin menu" });
  await expect(menu).toBeVisible();
  for (const label of ["Dashboard", "Inbox", "Inventory", "Add stock", "Scan bills", "Bills", "CRM", "Buyers", "Chats", "Settings"]) {
    await expect(menu.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
  await page.screenshot({ path: "screenshots/admin-menu-light-375.png", animations: "disabled" });
  await menu.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/settings$/);
  await expect(menu).toBeHidden();
});
