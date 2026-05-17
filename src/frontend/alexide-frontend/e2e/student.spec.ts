import { expect } from '@playwright/test';
import { studentTest as test } from './fixtures/withAuth';

test.describe('Student Dashboard', () => {
  test('student dashboard loads with sections', async ({ page }) => {
    await page.goto('/student/dashboard');
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15000 });
    await expect(page.locator('p[data-size="lg"]', { hasText: 'Pending Assignments' })).toBeVisible(
      { timeout: 15000 }
    );
    await expect(page.getByText('My Classes', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Grades by Class', { exact: true })).toBeVisible({
      timeout: 15000,
    });
  });

  test('student dashboard shows stats cards', async ({ page }) => {
    await page.goto('/student/dashboard');
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15000 });
    await expect(page.locator('p[data-size="xs"]', { hasText: 'Pending Assignments' })).toBeVisible(
      { timeout: 15000 }
    );
    await expect(page.getByText('Average Grade', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Active Classes', { exact: true })).toBeVisible({ timeout: 15000 });
  });

  test('student can navigate to view all classes', async ({ page }) => {
    await page.goto('/student/dashboard');
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15000 });
    await expect(page.getByText('My Classes', { exact: true })).toBeVisible({ timeout: 15000 });
    await page
      .getByRole('link', { name: /view all/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/student\/classes/, { timeout: 10000 });
  });
});
