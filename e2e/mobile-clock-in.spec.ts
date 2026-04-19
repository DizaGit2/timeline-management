/**
 * TIM-192 — Mobile Stability Test Suite
 * Path 1: Clock-In / Clock-Out  (highest priority)
 *
 * NOTE: Clock-in/out is being implemented in TIM-191 (frontend) and TIM-190
 * (backend). These tests are structured and ready to run; they are skipped
 * until those tasks ship. Remove skip() once the feature is merged to main.
 *
 * Covers:
 *   TC-MOB-CLK-01  Happy path — online clock-in
 *   TC-MOB-CLK-02  Happy path — online clock-out
 *   TC-MOB-CLK-03  Offline clock-in queues locally and shows offline indicator
 *   TC-MOB-CLK-04  Queued event syncs when connectivity restores
 *   TC-MOB-CLK-05  Duplicate tap prevention (debounce / loading state)
 *   TC-MOB-CLK-06  Error state — server returns 500
 *   TC-MOB-CLK-07  Sync status indicator: synced / pending / failed states
 *
 * Cross-browser: run on Mobile Chrome (Pixel 5) and Mobile Safari (iPhone 12)
 * via playwright.config.ts project matrix.
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Path 1 — Clock-In / Clock-Out", () => {
  test.skip(
    true,
    "Clock-in/out feature not yet implemented — activate once TIM-191 and TIM-190 are merged"
  );

  test.beforeEach(async ({ page }) => {
    await loginAs(page, "employee");
  });

  // ── TC-MOB-CLK-01: Online clock-in ─────────────────────────────────────────

  test("TC-MOB-CLK-01: employee can clock in when online", async ({ page }) => {
    await page.goto("/dashboard");

    // Clock-in CTA should be visible on mobile viewport
    const clockInBtn = page.getByRole("button", { name: /clock in/i });
    await expect(clockInBtn).toBeVisible();
    await clockInBtn.click();

    // Confirmation / clock-in screen loads
    await expect(page.getByText(/clocked in|clock-in recorded/i)).toBeVisible();
  });

  // ── TC-MOB-CLK-02: Online clock-out ────────────────────────────────────────

  test("TC-MOB-CLK-02: employee can clock out after clocking in", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    // Assume already clocked in (or clock in first)
    const clockInBtn = page.getByRole("button", { name: /clock in/i });
    if (await clockInBtn.isVisible()) {
      await clockInBtn.click();
      await page.waitForSelector("text=/clocked in|clock-in recorded/i");
    }

    const clockOutBtn = page.getByRole("button", { name: /clock out/i });
    await expect(clockOutBtn).toBeVisible();
    await clockOutBtn.click();

    await expect(page.getByText(/clocked out|clock-out recorded/i)).toBeVisible();
  });

  // ── TC-MOB-CLK-03: Offline queuing ─────────────────────────────────────────

  test("TC-MOB-CLK-03: offline clock-in queues locally with indicator", async ({
    page,
    context,
  }) => {
    await page.goto("/dashboard");

    // Simulate offline state by blocking all network requests
    await context.setOffline(true);

    const clockInBtn = page.getByRole("button", { name: /clock in/i });
    await expect(clockInBtn).toBeVisible();
    await clockInBtn.click();

    // Offline indicator must appear
    await expect(
      page.getByText(/offline|queued|saved.*sync/i)
    ).toBeVisible();

    // Entry should NOT show as failed — it should show as pending
    await expect(page.getByText(/failed|error/i)).not.toBeVisible();

    await context.setOffline(false);
  });

  // ── TC-MOB-CLK-04: Auto-sync on reconnect ──────────────────────────────────

  test("TC-MOB-CLK-04: queued clock-in syncs automatically when back online", async ({
    page,
    context,
  }) => {
    await page.goto("/dashboard");

    // Go offline and queue a clock-in
    await context.setOffline(true);
    await page.getByRole("button", { name: /clock in/i }).click();
    await expect(page.getByText(/offline|queued|saved.*sync/i)).toBeVisible();

    // Come back online — the sync should happen automatically
    await context.setOffline(false);

    await expect(
      page.getByText(/synced|clock-in recorded|sync.*complete/i)
    ).toBeVisible({ timeout: 15_000 });

    // Pending indicator should clear
    await expect(page.getByText(/queued|pending sync/i)).not.toBeVisible();
  });

  // ── TC-MOB-CLK-05: Duplicate tap prevention ────────────────────────────────

  test("TC-MOB-CLK-05: rapid taps do not create duplicate clock-in entries", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    const clockInBtn = page.getByRole("button", { name: /clock in/i });
    await expect(clockInBtn).toBeVisible();

    // Rapid double-tap
    await clockInBtn.click();
    await clockInBtn.click();

    // Button should be disabled or in a loading state after first tap
    await expect(clockInBtn).toBeDisabled();
  });

  // ── TC-MOB-CLK-06: Server error ────────────────────────────────────────────

  test("TC-MOB-CLK-06: server 500 shows error and allows retry", async ({
    page,
  }) => {
    // Intercept clock-in API to return 500
    await page.route("**/api/clock-in", (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: "Server error" }) })
    );

    await page.goto("/dashboard");

    await page.getByRole("button", { name: /clock in/i }).click();

    await expect(page.getByText(/failed|error|try again/i)).toBeVisible();

    // Retry button should be available
    await expect(
      page.getByRole("button", { name: /retry|try again/i })
    ).toBeVisible();
  });

  // ── TC-MOB-CLK-07: Sync status indicator states ────────────────────────────

  test("TC-MOB-CLK-07: sync status indicator shows correct states", async ({
    page,
    context,
  }) => {
    await page.goto("/dashboard");

    // Online and synced — no pending indicator
    await expect(page.getByText(/pending sync|syncing/i)).not.toBeVisible();

    // Go offline
    await context.setOffline(true);
    await page.getByRole("button", { name: /clock in/i }).click();

    // Should show "pending" indicator
    await expect(page.getByText(/pending|queued/i)).toBeVisible();

    // Reconnect
    await context.setOffline(false);

    // Should transition to "synced"
    await expect(page.getByText(/synced|sync.*complete/i)).toBeVisible({
      timeout: 15_000,
    });
  });
});
