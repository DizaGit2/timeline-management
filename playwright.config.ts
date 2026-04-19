/**
 * Playwright configuration for mobile stability test suite.
 * TIM-192 — Mobile Reliability Investment
 *
 * Tests run against a locally running dev stack (frontend :5173, backend :3000).
 * Targets two mobile device profiles per the UX requirement:
 *   - Mobile Chrome  (Android Pixel 5 viewport)
 *   - Mobile Safari  (iOS iPhone 12 viewport)
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { outputFolder: "playwright-report" }], ["list"]],

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 12"] },
    },
  ],
});
