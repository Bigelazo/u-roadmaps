import type { Page } from '@playwright/test';
import { expect } from './fixtures';
import { authenticateAs } from './helpers';

export async function enterRoadmap(page: Page, path: string, userId: string) {
  await authenticateAs(page.context(), userId);
  const recognition = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/notifications/acknowledge') &&
      response.request().method() === 'POST',
  );
  await page.goto(path);
  expect((await recognition).status()).toBe(200);
  await expect(page.locator('.react-flow')).toBeVisible();
}
