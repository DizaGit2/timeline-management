/**
 * Auth helpers for mobile E2E tests.
 * Provides login utilities for employee and manager roles.
 */
import { Page } from "@playwright/test";

export const TEST_USERS = {
  employee: {
    email: "employee@test.com",
    password: "testpassword123",
  },
  manager: {
    email: "manager@test.com",
    password: "testpassword123",
  },
};

/**
 * Logs in as the given user and waits for the dashboard to load.
 */
export async function loginAs(
  page: Page,
  role: keyof typeof TEST_USERS
): Promise<void> {
  const { email, password } = TEST_USERS[role];

  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log in|login/i }).click();
  await page.waitForURL(/\/dashboard/);
}

/**
 * Logs out by navigating directly to /login (clears local auth state).
 */
export async function logout(page: Page): Promise<void> {
  await page.goto("/login");
}
