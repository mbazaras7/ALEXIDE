import { expect } from '@playwright/test';
import { studentTest as test } from './fixtures/withAuth';
import { IDEPageObject } from './pages/IDEPage';

test.describe('IDE', () => {
  test('IDE page loads with file explorer', async ({ page }) => {
    const ide = new IDEPageObject(page);
    await ide.goto();
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(ide.fileExplorer).toBeVisible();
  });

  test('terminal toggles visible on click', async ({ page }) => {
    const ide = new IDEPageObject(page);
    await ide.goto();
    await ide.toggleTerminal();
    await expect(ide.terminalPanel).toBeVisible({ timeout: 5000 });
  });

  test('IDE shows empty editor state with no file selected', async ({ page }) => {
    const ide = new IDEPageObject(page);
    await ide.goto();
    await expect(ide.editorEmptyState).toBeVisible();
  });
});
