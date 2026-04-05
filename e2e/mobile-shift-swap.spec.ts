/**
 * TIM-192 — Mobile Stability Test Suite
 * Path 4: Shift Swap / Cover Request
 *
 * NOTE: The shift-swap UI flow for employees is not yet exposed as a
 * dedicated mobile page. These tests target what IS available (shift detail
 * viewing) and placeholder skipped tests for the swap request flow, which
 * should be activated once the feature is built.
 *
 * Covers:
 *   TC-MOB-SWP-01  Employee can navigate to Shifts page on mobile
 *   TC-MOB-SWP-02  Shifts list renders without blank screen
 *   TC-MOB-SWP-03  [SKIPPED] Submit shift swap request — activate when feature ships
 *   TC-MOB-SWP-04  [SKIPPED] Swap request shows confirmation, no silent failure
 *   TC-MOB-SWP-05  [SKIPPED] Duplicate swap submission is prevented
 *   TC-MOB-SWP-06  [SKIPPED] Manager sees swap request notification on mobile
 *
 * Cross-browser: Mobile Chrome (Pixel 5) + Mobile Safari (iPhone 12)
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const MOCK_SHIFTS = [
  {
    id: "shift-1",
    title: "Morning Shift",
    startTime: new Date(Date.now() + 86_400_000).toISOString(),
    endTime: new Date(Date.now() + 86_400_000 + 3_600_000 * 8).toISOString(),
    location: "Main Office",
    role: "Cashier",
    scheduleId: "sched-1",
    schedule: { id: "sched-1", name: "This Week" },
    employeeId: "emp-1",
    employee: { id: "emp-1", firstName: "Alice", lastName: "Smith", position: "Cashier" },
    assignments: [],
    requiredHeadcount: 2,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

test.describe("Path 4 — Shift Swap / Cover Request", () => {
  // ── TC-MOB-SWP-01: Navigate to Shifts page ──────────────────────────────

  test("TC-MOB-SWP-01: manager can navigate to Shifts page on mobile", async ({
    page,
  }) => {
    await page.route("**/api/shifts*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SHIFTS),
      })
    );
    await page.route("**/api/schedules*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      })
    );

    await loginAs(page, "manager");
    await page.goto("/shifts");

    await expect(page.getByRole("heading", { name: /shifts/i })).toBeVisible();
  });

  // ── TC-MOB-SWP-02: Shifts list renders without blank screen ─────────────

  test("TC-MOB-SWP-02: shifts list renders and does not show blank screen", async ({
    page,
  }) => {
    await page.route("**/api/shifts*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SHIFTS),
      })
    );
    await page.route("**/api/schedules*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      })
    );

    await loginAs(page, "manager");
    await page.goto("/shifts");

    // Page shell always renders
    await expect(page.getByRole("heading", { name: /shifts/i })).toBeVisible();

    // No unhandled error
    await expect(page.getByText(/uncaught error|something went wrong/i)).not.toBeVisible();
  });

  // ── TC-MOB-SWP-03–06: SKIPPED — await feature implementation ────────────

  test.skip("TC-MOB-SWP-03: employee can submit shift swap request from mobile", async ({
    page,
  }) => {
    // TODO: implement once shift-swap request UI is built
    // 1. loginAs employee
    // 2. Navigate to /my-schedule
    // 3. Tap a shift
    // 4. Find "Request Swap" button
    // 5. Fill form and submit
    // 6. Expect confirmation message
  });

  test.skip("TC-MOB-SWP-04: swap request shows confirmation, no silent failure", async ({
    page,
  }) => {
    // TODO: implement once shift-swap request UI is built
    // Simulate API returning 201 and verify visible confirmation
  });

  test.skip("TC-MOB-SWP-05: duplicate swap submission is prevented", async ({
    page,
  }) => {
    // TODO: implement once shift-swap request UI is built
    // Rapid double-tap on Submit should disable button after first click
  });

  test.skip("TC-MOB-SWP-06: manager sees pending swap request on mobile dashboard", async ({
    page,
  }) => {
    // TODO: implement once notification/swap UI is built for manager view
  });
});
