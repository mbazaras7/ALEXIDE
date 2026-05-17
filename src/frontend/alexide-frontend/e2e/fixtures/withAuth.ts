/// <reference types="@playwright/test" />
import { test as base } from '@playwright/test';
import fs from 'fs';

type LocalStorageItem = { name: string; value: string };

function getStorageState(role: 'student' | 'teacher'): LocalStorageItem[] {
  const state = JSON.parse(fs.readFileSync(`e2e/.auth/${role}.json`, 'utf-8'));
  return state.origins?.[0]?.localStorage ?? [];
}

function decodeJwtPayload(token: string) {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
}

function createFixture(role: 'student' | 'teacher') {
  return base.extend({
    page: async ({ page }, use) => {
      const items = getStorageState(role);
      const token = items.find((i: LocalStorageItem) => i.name === 'authToken')?.value ?? '';
      const payload = decodeJwtPayload(token);

      await page.addInitScript((storageItems: LocalStorageItem[]) => {
        storageItems.forEach(({ name, value }) => localStorage.setItem(name, value));
      }, items);

      await page.route('**/api/backend/auth/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: payload.userId,
              email: payload.email,
              role: payload.role,
              name: role === 'student' ? 'Test Student' : 'Test Teacher',
            },
          }),
        });
      });

      await page.route('**/api/backend/files/tree', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        });
      });

      await use(page);
    },
  });
}

export const studentTest = createFixture('student');
export const teacherTest = createFixture('teacher');
