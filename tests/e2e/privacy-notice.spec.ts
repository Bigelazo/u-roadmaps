import { expect, test } from './fixtures';

test('the footer links to a privacy notice that covers data, sources, purpose, retention, rights and contact', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('contentinfo').getByRole('link', { name: 'Privacidad' }).click();
  await expect(page).toHaveURL('/privacy');
  await expect(page).toHaveTitle('Aviso de privacidad | U-Roadmaps');
  await expect(page.getByRole('heading', { level: 1, name: 'Aviso de privacidad' })).toBeVisible();
  await expect(page.getByRole('main')).toContainText('Ley 21.719');

  for (const section of [
    'Qué datos tratamos',
    'De dónde provienen',
    'Para qué los usamos',
    'Cuánto tiempo los conservamos',
    'Tus derechos',
    'Contacto',
  ]) {
    await expect(page.getByRole('heading', { level: 2, name: section })).toBeVisible();
  }
});
