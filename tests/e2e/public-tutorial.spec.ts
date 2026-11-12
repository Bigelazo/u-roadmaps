import { expect, test } from './fixtures';

for (const { option, experience } of [
  { option: 'Docente', experience: 'teaching' },
  { option: 'Estudiante', experience: 'student' },
] as const) {
  test(`an anonymous visitor starts the ${experience} tutorial from the landing and returns to it`, async ({
    page,
  }) => {
    const activityRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/tutorial/'))
        activityRequests.push(request.url());
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Probar tutorial' }).click();
    const choice = page.getByRole('dialog', { name: '¿Cómo deseas realizar el tutorial?' });
    await expect(choice).toContainText('Nada de lo que hagas se guarda.');
    await choice.getByRole('button', { name: option, exact: true }).click();

    await expect(page).toHaveURL(`/practice-roadmap/${experience}?origin=%2F`);
    await expect(page.locator('.driver-popover')).toBeVisible();
    await expect(page.locator('header').filter({ hasText: 'AA0000' })).toContainText('Tutorial');

    await page.getByRole('link', { name: 'Salir', exact: true }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('button', { name: 'Probar tutorial' })).toBeVisible();
    expect(activityRequests).toEqual([]);
  });

  test(`the ${experience} practice URL is public without an origin`, async ({ page }) => {
    await page.goto(`/practice-roadmap/${experience}`);
    await expect(page.locator('.driver-popover')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Salir', exact: true })).toHaveAttribute(
      'href',
      '/',
    );
  });
}

test('an anonymous student completes the tutorial and learns how to access notices', async ({
  page,
}) => {
  await page.goto('/practice-roadmap/student');
  await expect(page.locator('.driver-popover')).toBeVisible();
  for (let step = 1; step < 11; step++) {
    await page.locator('.driver-popover').getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.locator('.driver-popover-progress-text')).toHaveText(`${step + 1} de 11`);
  }
  await expect(page.locator('.driver-popover')).toContainText('Cuando ingreses con U-Pasaporte');
  await expect(page.locator('[data-global-navigation]')).toHaveClass(/driver-active-element/);
  await page.locator('.driver-popover').getByRole('button', { name: 'Finalizar' }).click();
  await expect(page.locator('.driver-popover')).toHaveCount(0);
  await page.getByRole('link', { name: 'Salir', exact: true }).click();
  await expect(page).toHaveURL('/');
});

test('an anonymous visitor can dismiss the tutorial choice and protected courses still require login', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Probar tutorial' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL('/');

  const protectedRoute = await request.get('/academic-overview', { maxRedirects: 0 });
  expect(protectedRoute.status()).toBe(307);
  expect(protectedRoute.headers().location).toContain('/api/plogin/start');
  const invalidExperience = await request.get('/practice-roadmap/invalid');
  expect(invalidExperience.status()).toBe(404);
});
