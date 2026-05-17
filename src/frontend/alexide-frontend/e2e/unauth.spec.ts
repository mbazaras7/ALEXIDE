import { test, expect } from '@playwright/test';

test.describe('Route Protection', () => {
  test('unauthenticated user is redirected from student dashboard', async ({ page }) => {
    await page.goto('/student/dashboard');
    await expect(page).toHaveURL(/\/auth/, { timeout: 10000 });
  });

  test('unauthenticated user is redirected from teacher dashboard', async ({ page }) => {
    await page.goto('/teacher/dashboard');
    await expect(page).toHaveURL(/\/auth/, { timeout: 10000 });
  });

  test('unauthenticated user is redirected from IDE', async ({ page }) => {
    await page.goto('/ide');
    await expect(page).not.toHaveURL(/\/ide/, { timeout: 10000 });
  });
});
