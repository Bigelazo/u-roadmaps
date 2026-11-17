import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

async function expectFooterAtViewportBottom(page: Page) {
  const layout = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
    footerBottom: document.querySelector('footer')?.getBoundingClientRect().bottom ?? 0,
  }));
  expect(layout.scrollHeight).toBeLessThanOrEqual(layout.viewportHeight);
  expect(Math.round(layout.footerBottom)).toBe(layout.viewportHeight);
}

test('an unknown address answers 404 with a Spanish page, the footer and ways forward', async ({
  page,
}) => {
  const response = await page.goto('/esta-ruta-no-existe');
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle('Página no encontrada | U-Roadmaps');
  await expect(page.getByRole('heading', { name: 'No encontramos esta página' })).toBeVisible();
  await expect(page.getByRole('contentinfo')).toContainText(
    'Los contenidos de tus cursos merecen un mapa.',
  );
  await expectFooterAtViewportBottom(page);

  await expect(page.getByRole('link', { name: 'Ver mis cursos' })).toHaveAttribute(
    'href',
    '/academic-overview',
  );
  await page.getByRole('link', { name: 'Ir al inicio' }).click();
  await expect(page).toHaveURL('/');
});

test('a server failure answers 500 with a Spanish page, the footer and no code or actions', async ({
  page,
}) => {
  const response = await page.goto('/development/server-error');
  expect(response?.status()).toBe(500);
  await expect(page.getByRole('heading', { name: 'No pudimos cargar esta página' })).toBeVisible();
  await expect(page.getByRole('main')).toContainText(
    'Ocurrió un fallo inesperado. Vuelve a intentarlo más tarde.',
  );
  await expect(page.getByRole('main')).not.toContainText('500');
  await expect(page.getByRole('main').getByRole('link')).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('contentinfo')).toContainText(
    'Los contenidos de tus cursos merecen un mapa.',
  );
  await expectFooterAtViewportBottom(page);
});
