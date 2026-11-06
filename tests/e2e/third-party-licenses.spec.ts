import { expect, test } from './fixtures';
import { authenticateAs } from './helpers';

const licensesLink = { name: 'Licencias de terceros', exact: true };

test('the landing page links to the LGPL notice, its copyright, license and sources', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await page.getByRole('link', licensesLink).click();
  await expect(page).toHaveURL('/third-party-licenses');
  await expect(page.getByRole('heading', { name: 'Licencias de terceros' })).toBeVisible();
  await expect(page.getByRole('main')).toContainText('LGPL-2.1-or-later');
  await expect(page.getByRole('main')).toContainText('Copyright (C) 2004-2014 Monash University');
  await expect(page.getByRole('link', { name: 'Código fuente de esta versión' })).toHaveAttribute(
    'href',
    'https://github.com/Aksem/adaptagrams/tree/v1.0.4',
  );
  await expect(
    page.getByRole('link', { name: 'Código fuente e instrucciones de compilación' }),
  ).toHaveAttribute('href', 'https://github.com/Aksem/libavoid-js/tree/v0.4.5');

  const license = await page
    .getByRole('link', { name: 'Leer el texto completo de la licencia' })
    .getAttribute('href');
  const response = await request.get(license!);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('text/plain');
  expect(await response.text()).toContain('GNU LESSER GENERAL PUBLIC LICENSE');

  const wasm = await page.getByRole('link', { name: 'archivo aparte' }).getAttribute('href');
  expect((await request.get(wasm!)).status()).toBe(200);
});

test('signed-in users reach the notice from their course list', async ({ page, course }) => {
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto('/academic-overview');
  await page.getByRole('link', licensesLink).click();
  await expect(page).toHaveURL('/third-party-licenses');
});
