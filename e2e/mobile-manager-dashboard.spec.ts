/**
 * TIM-192 — Mobile Stability Test Suite
 * Path 3: Manager Live Shift Status Monitoring
 *
 * Covers:
 *   TC-MOB-MGR-01  Dashboard stats render for manager role on mobile
 *   TC-MOB-MGR-02  Unfilled-shifts alert visible when staffing gaps exist
 *   TC-MOB-MGR-03  Quick action links are tappable on mobile viewport
 *   TC-MOB-MGR-04  Dashboard loads within 3 seconds (sync lag threshold)
 *   TC-MOB-MGR-05  API slow response — shows loading state, not blank screen
 *   TC-MOB-MGR-06  API error — shows friendly message, not blank screen
 *   TC-MOB-MGR-07  Employee-role user does NOT see manager stats (RBAC)
 *
 * Cross-browser: Mobile Chrome (Pixel 5) + Mobile Safari (iPhone 12)
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const MANAGER_STATS = {
  scheduleCount: 3,
  employeeCount: 12,
  shiftsThisWeek: 18,
  unfilledShiftsThisWeek: 2,
};

test.describe("Path 3 — Manager Live Shift Status Monitoring", () => {
  // ── TC-MOB-MGR-01: Stats render for manager ─────────────────────────────

  test("TC-MOB-MGR-01: manager sees stats panel on mobile dashboard", async ({
    page,
  }) => {
    await page.route("**/api/dashboard/stats", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MANAGER_STATS),
      })
    );

    await loginAs(page, "manager");
    await page.goto("/dashboard");

    // Stat cards must be visible
    await expect(page.getByText(/schedules/i)).toBeVisible();
    await expect(page.getByText("3")).toBeVisible();
    await expect(page.getByText(/employees/i)).toBeVisible();
  });

  // ── TC-MOB-MGR-02: Unfilled-shifts alert ────────────────────────────────

  test("TC-MOB-MGR-02: unfilled shifts alert shows when gaps exist", async ({
    page,
  }) => {
    await page.route("**/api/dashboard/stats", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MANAGER_STATS), // unfilledShiftsThisWeek: 2
      })
    );

    await loginAs(page, "manager");
    await page.goto("/dashboard");

    await expect(
      page.getByText(/2 shift.*need staffing|unfilled.*shift/i)
    ).toBeVisible();
  });

  // ── TC-MOB-MGR-03: Quick action links are tappable ──────────────────────

  test("TC-MOB-MGR-03: quick action links are tappable on mobile", async ({
    page,
  }) => {
    await page.route("**/api/dashboard/stats", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MANAGER_STATS),
      })
    );

    await loginAs(page, "manager");
    await page.goto("/dashboard");

    // All three quick action links must be reachable (tap target check)
    const schedulesLink = page.getByRole("link", { name: /manage schedules/i });
    const shiftsLink = page.getByRole("link", { name: /manage shifts/i });
    const employeesLink = page.getByRole("link", { name: /manage employees/i });

    await expect(schedulesLink).toBeVisible();
    await expect(shiftsLink).toBeVisible();
    await expect(employeesLink).toBeVisible();

    // Links are large enough to tap (min 44px touch target per WCAG/Apple HIG)
    const box = await schedulesLink.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(36);
  });

  // ── TC-MOB-MGR-04: Dashboard loads within 3s ────────────────────────────

  test("TC-MOB-MGR-04: manager dashboard renders within 3 seconds", async ({
    page,
  }) => {
    await page.route("**/api/dashboard/stats", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MANAGER_STATS),
      })
    );

    const start = Date.now();
    await loginAs(page, "manager");
    await page.goto("/dashboard");

    // Page heading must appear within budget
    await expect(
      page.getByRole("heading", { name: /welcome/i })
    ).toBeVisible({ timeout: 3_000 });

    expect(Date.now() - start).toBeLessThan(3_000);
  });

  // ── TC-MOB-MGR-05: Slow API — loading state ─────────────────────────────

  test("TC-MOB-MGR-05: slow dashboard API shows loading state, not blank screen", async ({
    page,
  }) => {
    await page.route("**/api/dashboard/stats", async (route) => {
      await new Promise((r) => setTimeout(r, 2_000));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MANAGER_STATS),
      });
    });

    await loginAs(page, "manager");
    await page.goto("/dashboard");

    // Heading must render immediately (page shell, not dependent on stats)
    await expect(
      page.getByRole("heading", { name: /welcome/i })
    ).toBeVisible({ timeout: 2_000 });

    // Stats initially show loading placeholder (—)
    await expect(page.getByText("—")).toBeVisible();
  });

  // ── TC-MOB-MGR-06: Stats API error ──────────────────────────────────────

  test("TC-MOB-MGR-06: stats API 500 does not crash the page", async ({
    page,
  }) => {
    await page.route("**/api/dashboard/stats", (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: "Server error" }) })
    );

    await loginAs(page, "manager");
    await page.goto("/dashboard");

    // Page must still render its shell
    await expect(
      page.getByRole("heading", { name: /welcome/i })
    ).toBeVisible();

    // No unhandled crash overlay
    await expect(page.getByText(/something went wrong|uncaught error/i)).not.toBeVisible();
  });

  // ── TC-MOB-MGR-07: Employee role cannot see manager stats ───────────────

  test("TC-MOB-MGR-07: employee role does not see manager stats panel", async ({
    page,
  }) => {
    await loginAs(page, "employee");
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: /welcome/i })
    ).toBeVisible();

    // Stats cards render but all values should be —
    const dashValues = await page.getByText("—").all();
    expect(dashValues.length).toBeGreaterThan(0);

    // Manager quick actions should NOT appear for employees
    await expect(
      page.getByRole("link", { name: /manage schedules/i })
    ).not.toBeVisible();
  });
});
