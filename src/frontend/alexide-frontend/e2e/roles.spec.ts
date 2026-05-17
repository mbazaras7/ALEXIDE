import { expect } from '@playwright/test';
import { studentTest, teacherTest } from './fixtures/withAuth';

studentTest('student cannot access teacher dashboard', async ({ page }) => {
  await page.goto('/teacher/dashboard');
  await expect(page).not.toHaveURL(/\/teacher\/dashboard/, { timeout: 10000 });
});

teacherTest('teacher cannot access student dashboard', async ({ page }) => {
  await page.goto('/student/dashboard');
  await expect(page).not.toHaveURL(/\/student\/dashboard/, { timeout: 10000 });
});
