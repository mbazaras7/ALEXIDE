import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';

test.describe('Authentication', () => {
  test('student can log in and reaches student dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('student@test.com', 'Test1234!');
    await expect(page).toHaveURL(/\/student\/dashboard/, { timeout: 15000 });
    await expect(page.locator('p[data-size="lg"]', { hasText: 'Pending Assignments' })).toBeVisible(
      { timeout: 15000 }
    );
  });

  test('teacher can log in and reaches teacher dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('teacher@test.com', 'Test1234!');
    await expect(page).toHaveURL(/\/teacher\/dashboard/, { timeout: 15000 });
    await expect(page.getByText('My Classes', { exact: true })).toBeVisible({ timeout: 15000 });
  });

  test('invalid credentials shows error', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('wrong@test.com', 'badpass');
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10000 });
  });

  test('student can log out', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('student@test.com', 'Test1234!');
    await expect(page).toHaveURL(/\/student\/dashboard/, { timeout: 15000 });
    await page.getByTestId('user-menu-button').click();
    await page.getByRole('menuitem', { name: /logout/i }).click();
    await expect(page).toHaveURL(/\/auth/, { timeout: 10000 });
  });

  test('teacher can log out', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('teacher@test.com', 'Test1234!');
    await expect(page).toHaveURL(/\/teacher\/dashboard/, { timeout: 15000 });
    await page.getByTestId('user-menu-button').click();
    await page.getByRole('menuitem', { name: /logout/i }).click();
    await expect(page).toHaveURL(/\/auth/, { timeout: 10000 });
  });
});
