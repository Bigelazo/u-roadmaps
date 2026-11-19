import { expect, test } from './fixtures';
import { authenticateAs } from './helpers';

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

test('the roadmap offers the theme toggle in the global navigation when opened directly', async ({
  page,
  course,
}) => {
  await authenticateAs(page.context(), course.users.studentWithProgress.id);
  await page.goto(course.pagePath());

  const courseHeader = page.locator('main header:has(h1)');
  await expect(courseHeader.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cambiar a tema oscuro' })).toHaveCount(1);
  await expect(
    page.locator('[data-global-navigation]').getByRole('button', { name: 'Cambiar a tema oscuro' }),
  ).toBeVisible();
});

test('the embedded roadmap offers the theme toggle in its course header', async ({
  page,
  course,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await authenticateAs(page.context(), course.users.studentWithProgress.id);
  await page.goto('/privacy');
  await page.evaluate((src) => {
    document.body.replaceChildren();
    const frame = document.createElement('iframe');
    frame.src = src;
    frame.style.cssText = 'width:1200px;height:800px';
    document.body.append(frame);
  }, course.pagePath());
  const roadmap = page.frameLocator('iframe');
  const courseHeader = roadmap.locator('main header:has(h1)');
  await expect(courseHeader.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(roadmap.locator('[data-global-navigation]')).toHaveCount(0);

  await courseHeader.getByRole('button', { name: 'Cambiar a tema oscuro' }).click();

  await expect(roadmap.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect((await page.context().cookies()).find((cookie) => cookie.name === 'theme')?.value).toBe(
    'dark',
  );
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
