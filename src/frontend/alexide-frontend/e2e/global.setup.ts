import { chromium, expect } from '@playwright/test';
import { execSync } from 'child_process';

async function globalSetup() {
  console.log('Seeding E2E test users...');

  const isCI = process.env.CI === 'true';
  if (isCI) {
    console.log('CI detected - skipping docker seed, already seeded in before_script');
  } else {
    execSync('docker exec alexide-backend sh -c "cd /app && npm run seed:e2e"', {
      stdio: 'inherit',
    });
  }

  const fs = await import('fs');
  fs.mkdirSync('e2e/.auth', { recursive: true });

  const browser = await chromium.launch();

  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  await studentPage.goto('http://localhost:3001/auth');
  await studentPage.locator('input[type="email"]').fill('student@test.com');
  await studentPage.locator('input[type="password"]').fill('Test1234!');
  await studentPage.getByRole('button', { name: /sign in/i }).click();
  await expect(studentPage).not.toHaveURL(/auth/, { timeout: 15000 });
  await studentContext.storageState({ path: 'e2e/.auth/student.json' });

  const teacherContext = await browser.newContext();
  const teacherPage = await teacherContext.newPage();
  await teacherPage.goto('http://localhost:3001/auth');
  await teacherPage.locator('input[type="email"]').fill('teacher@test.com');
  await teacherPage.locator('input[type="password"]').fill('Test1234!');
  await teacherPage.getByRole('button', { name: /sign in/i }).click();
  await expect(teacherPage).not.toHaveURL(/auth/, { timeout: 15000 });
  await teacherContext.storageState({ path: 'e2e/.auth/teacher.json' });

  await browser.close();
}

export default globalSetup;
