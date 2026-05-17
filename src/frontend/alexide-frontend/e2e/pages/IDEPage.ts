import { Page, expect } from '@playwright/test';

export class IDEPageObject {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/student/ide');
    await expect(this.page.getByText('FILES', { exact: true })).toBeVisible({ timeout: 15000 });
  }

  async toggleTerminal() {
    await this.page.locator('[class*="statusBar"] span', { hasText: 'Terminal' }).click();
  }

  get terminalPanel() {
    return this.page.locator('.xterm-screen');
  }

  get fileExplorer() {
    return this.page.getByText('FILES', { exact: true });
  }

  get editorEmptyState() {
    return this.page.getByText('No file selected', { exact: true });
  }
}
