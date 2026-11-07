import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { hasStack, PUBLIC_ARTICLE_CODE, seedPublicArticle } from "./helpers";
import { pages as basePages, themes, widths } from "./pages";

// With a database behind the site, the catalog and article pages are photographed with a real article on them.
const pages = hasStack ? [...basePages, { name: "article", path: `catalog/${PUBLIC_ARTICLE_CODE}` }] : basePages;

test.beforeAll(async () => {
  if (hasStack) await seedPublicArticle();
});

/*
  For every page × width × theme:
  - full-page screenshot saved to screenshots/ (reviewed against DESIGN.md each step)
  - no horizontal scroll (nothing wider than the screen)
  - accessibility scan (axe, WCAG 2.1 A/AA) with zero violations
*/

async function openInTheme(page: Page, path: string, theme: (typeof themes)[number]) {
  // The saved-theme cookie is read by the no-flash script before first paint.
  const base = String(test.info().project.use.baseURL);
  await page.context().addCookies([{ name: "ls-theme", value: theme, url: base }]);
  await page.goto(path, { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await page.evaluate(() => document.fonts.ready);
}

for (const p of pages) {
  for (const theme of themes) {
    for (const w of widths) {
      test(`${p.name} · ${theme} · ${w.name}px`, async ({ page }) => {
        await page.setViewportSize({ width: w.width, height: w.height });
        await openInTheme(page, p.path, theme);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, "page must not scroll sideways").toBeLessThanOrEqual(0);

        // Scroll through once so lazy-loaded images below the fold load, as they would for a real visitor.
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 50));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForLoadState("networkidle");
        // Photos fade in when loaded; capture only once every one is in and the fade has finished.
        await page.addStyleTag({ content: "img { transition: none !important; }" });
        await page.evaluate(() => document.querySelectorAll("img").forEach((img) => (img.loading = "eager")));
        await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0));
        // Photos decode off-screen; make sure they are painted before the picture is taken.
        await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode().catch(() => undefined))));
        await page.waitForTimeout(400);
        // The first full-page capture makes Chrome paint every tile; the second is the one we keep.
        await page.screenshot({ animations: "disabled", fullPage: true });
        await page.screenshot({ path: `screenshots/${p.name}-${theme}-${w.name}.png`, fullPage: true, animations: "disabled" });

        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
        expect(summary, "accessibility violations").toEqual([]);
      });
    }
  }
}

test("theme toggle switches, is remembered, and does not flash on reload", async ({ page }) => {
  await page.goto("dev/styleguide");
  const html = page.locator("html");
  const before = await html.getAttribute("data-theme");
  await page.locator("header ~ div button, main button").filter({ hasText: /Switch to (dark|light) theme/ }).first().click();
  const after = before === "dark" ? "light" : "dark";
  await expect(html).toHaveAttribute("data-theme", after);

  // On reload the attribute must already be right in the very first HTML the browser paints.
  const themeAtFirstPaint = new Promise<string | null>((resolve) => {
    page.once("domcontentloaded", async () => resolve(await html.getAttribute("data-theme")));
  });
  await page.reload();
  expect(await themeAtFirstPaint).toBe(after);
});
