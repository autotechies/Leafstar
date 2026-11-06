import { defineConfig, devices } from "@playwright/test";

/*
  End-to-end and screenshot tests.
  - PW_CHROMIUM_PATH: use an already-installed Chromium (Claude's sandbox); CI installs its own.
  - PW_BASE_URL: test a running site instead of starting one (e.g. the GitHub Pages preview).
*/
const port = Number(process.env.PW_PORT ?? 3100);
const rawBase = process.env.PW_BASE_URL ?? `http://127.0.0.1:${port}`;
const baseURL = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;
const phone = { ...devices["Pixel 7"], launchOptions: executablePath ? { executablePath } : undefined };
const browser = { ...devices["Desktop Chrome"], launchOptions: executablePath ? { executablePath } : undefined };

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // On GitHub, failures also become annotations on the check, readable without downloading logs.
  reporter: process.env.CI ? [["list"], ["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [
    // Public pages and shared components: run in parallel.
    { name: "chromium", testIgnore: /(admin-.*|.*-phone)\.spec\.ts/, use: { ...browser } },
    // Real touch input (swipe, double-tap) on a phone-sized screen.
    { name: "phone", testMatch: /.*-phone\.spec\.ts/, use: { ...phone } },
    // Login, Settings and two-step login change the one test account, so they run in order, alone.
    { name: "admin-flows", testMatch: /admin-flows\.spec\.ts/, fullyParallel: false, use: { ...browser } },
    // Screenshots of admin pages, after the flows have put the account back to normal.
    { name: "admin-visual", testMatch: /admin-visual\.spec\.ts/, dependencies: ["admin-flows"], use: { ...browser } },
  ],
  webServer: process.env.PW_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${port} -H 127.0.0.1`,
        url: rawBase,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
