import { expect } from '@playwright/test';
import { teacherTest as test } from './fixtures/withAuth';

test.describe('Teacher Dashboard', () => {
  test('teacher dashboard loads with stats', async ({ page }) => {
    await page.goto('/teacher/dashboard');
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15000 });
    await expect(page.getByText('My Classes', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Total Students', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Active Classes', { exact: true })).toBeVisible({ timeout: 15000 });
  });

  test('teacher can navigate to manage classes', async ({ page }) => {
    await page.goto('/teacher/dashboard');
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15000 });
    await expect(page.getByText('My Classes', { exact: true })).toBeVisible({ timeout: 15000 });
    const link = page.getByRole('link', { name: /view all/i }).first();
    await link.waitFor({ state: 'visible' });
    await page.waitForTimeout(300);
    await link.click();
    await expect(page).toHaveURL(/\/teacher\/classes/, { timeout: 10000 });
  });

  test('teacher can navigate to monitor students', async ({ page }) => {
    await page.goto('/teacher/dashboard');
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15000 });
    await expect(page.getByText('My Classes', { exact: true })).toBeVisible({ timeout: 15000 });
    await page.goto('/teacher/classes');
    await expect(page).toHaveURL(/\/teacher\/classes/, { timeout: 10000 });
  });
});
