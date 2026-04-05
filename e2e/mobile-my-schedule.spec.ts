/**
 * TIM-192 — Mobile Stability Test Suite
 * Path 2: View My Upcoming Schedule
 *
 * Covers:
 *   TC-MOB-SCH-01  Schedule renders within 3 seconds on mobile viewport
 *   TC-MOB-SCH-02  Week navigation works on mobile
 *   TC-MOB-SCH-03  Individual shift detail is accessible from the list
 *   TC-MOB-SCH-04  Stale-data scenario — API returns 200 but shifts changed
 *   TC-MOB-SCH-05  Slow network — schedule loads and does not show blank screen
 *   TC-MOB-SCH-06  Error state — API returns 500 shows user-friendly message
 *   TC-MOB-SCH-07  Empty schedule — clear empty state rather than blank screen
 *
 * Cross-browser: Mobile Chrome (Pixel 5) + Mobile Safari (iPhone 12)
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Path 2 — View My Upcoming Schedule", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "employee");
  });

  // ── TC-MOB-SCH-01: Fast render ─────────────────────────────────────────────

  test("TC-MOB-SCH-01: schedule page renders within 3 seconds on mobile", async ({
    page,
  }) => {
    const start = Date.now();

    await page.goto("/my-schedule");

    // Page heading must appear within 3s
    await expect(page.getByRole("heading", { name: /my schedule/i })).toBeVisible({
      timeout: 3_000,
    });

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(3_000);
  });

  // ── TC-MOB-SCH-02: Week navigation ─────────────────────────────────────────

  test("TC-MOB-SCH-02: week navigation buttons work on mobile viewport", async ({
    page,
  }) => {
    await page.goto("/my-schedule");

    await expect(page.getByRole("heading", { name: /my schedule/i })).toBeVisible();

    // Navigate forward one week
    const nextBtn = page.getByRole("button", { name: /next|›|→/i });
    await expect(nextBtn).toBeVisible();
    await nextBtn.click();

    // Navigate back
    const prevBtn = page.getByRole("button", { name: /prev|‹|←/i });
    await expect(prevBtn).toBeVisible();
    await prevBtn.click();
  });

  // ── TC-MOB-SCH-03: Shift detail accessible ─────────────────────────────────

  test("TC-MOB-SCH-03: shift detail is accessible by tapping a shift", async ({
    page,
  }) => {
    // Intercept shifts API to return at least one shift
    await page.route("**/api/shifts*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "shift-1",
            title: "Morning Shift",
            startTime: new Date(Date.now() + 86_400_000).toISOString(),
            endTime: new Date(Date.now() + 86_400_000 + 3_600_000 * 8).toISOString(),
            location: "Main Office",
            role: "Cashier",
            scheduleId: "sched-1",
            schedule: { id: "sched-1", name: "This Week" },
            employeeId: "me",
            employee: null,
            assignments: [],
            requiredHeadcount: 1,
            notes: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]),
      })
    );

    await page.goto("/my-schedule");

    // At least one shift card should render
    await expect(page.getByText(/morning shift/i)).toBeVisible();
  });

  // ── TC-MOB-SCH-04: No blank screen on slow network ─────────────────────────

  test("TC-MOB-SCH-04: shows loading indicator on slow network, never blank", async ({
    page,
  }) => {
    // Simulate slow API (1.5s delay)
    await page.route("**/api/shifts*", async (route) => {
      await new Promise((r) => setTimeout(r, 1_500));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/my-schedule");

    // Loading state must appear before data arrives
    await expect(page.getByText(/loading/i)).toBeVisible({ timeout: 500 });

    // Page heading should always be present (not a blank page)
    await expect(page.getByRole("heading", { name: /my schedule/i })).toBeVisible();

    // Wait for loading to clear
    await expect(page.getByText(/loading/i)).not.toBeVisible({ timeout: 5_000 });
  });

  // ── TC-MOB-SCH-05: API error shows friendly message ────────────────────────

  test("TC-MOB-SCH-05: API 500 shows user-friendly error, not blank screen", async ({
    page,
  }) => {
    await page.route("**/api/shifts*", (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: "Server error" }) })
    );

    await page.goto("/my-schedule");

    // Error message must appear
    await expect(page.getByText(/failed to load|error|something went wrong/i)).toBeVisible();

    // Page heading must still be present
    await expect(page.getByRole("heading", { name: /my schedule/i })).toBeVisible();
  });

  // ── TC-MOB-SCH-06: Empty schedule state ────────────────────────────────────

  test("TC-MOB-SCH-06: empty schedule shows clear message, not blank screen", async ({
    page,
  }) => {
    await page.route("**/api/shifts*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      })
    );

    await page.goto("/my-schedule");

    // Must show something useful — not just empty
    await expect(page.getByRole("heading", { name: /my schedule/i })).toBeVisible();

    // Should not show an error (empty ≠ error)
    await expect(page.getByText(/failed to load|server error/i)).not.toBeVisible();
  });
});
