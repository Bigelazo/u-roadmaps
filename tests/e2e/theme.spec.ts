import { expect, test } from './fixtures';

const pageBackground = () => getComputedStyle(document.body).backgroundColor;

test('the light theme is the default and ignores a dark system', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(pageBackground)).toBe('rgb(255, 255, 255)');
});

test('a chosen dark theme applies at once and survives a reload', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  await page.getByRole('button', { name: 'Cambiar a tema oscuro' }).click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(pageBackground)).toBe('rgb(25, 32, 43)');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Cambiar a tema claro' })).toBeVisible();
});
