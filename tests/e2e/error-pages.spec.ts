import { expect, test } from './fixtures';

test('an unknown address answers 404 with a Spanish page, the footer and ways forward', async ({
  page,
}) => {
  const response = await page.goto('/esta-ruta-no-existe');
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle('Página no encontrada | U-Roadmaps');
  await expect(page.getByRole('heading', { name: 'No encontramos esta página' })).toBeVisible();
  await expect(page.getByRole('contentinfo')).toContainText('Cada curso, una ruta clara.');

  await expect(page.getByRole('link', { name: 'Ver mis cursos' })).toHaveAttribute(
    'href',
    '/academic-overview',
  );
  await page.getByRole('link', { name: 'Ir al inicio' }).click();
  await expect(page).toHaveURL('/');
});

test('a server failure answers 500 with a Spanish page, the footer and a retry', async ({
  page,
}) => {
  const response = await page.goto('/development/server-error');
  expect(response?.status()).toBe(500);
  const heading = page.getByRole('heading', { name: 'No pudimos cargar esta página' });
  await expect(heading).toBeVisible();
  await expect(page.getByRole('contentinfo')).toContainText('Cada curso, una ruta clara.');
  await expect(page.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/');

  await page.getByRole('button', { name: 'Intentar de nuevo' }).click();
  await expect(heading).toBeVisible();
});
