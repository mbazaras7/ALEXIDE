import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

type AuthFixtures = {
  studentPage: void;
  teacherPage: void;
};

export const test = base.extend<AuthFixtures>({
  studentPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('student@test.com', 'password123');
    await page.waitForURL('/student/dashboard');
    await use();
  },
  teacherPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('teacher@test.com', 'password123');
    await page.waitForURL('/teacher/dashboard');
    await use();
  },
});

export { expect } from '@playwright/test';
