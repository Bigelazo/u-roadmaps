import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

function tourPopover(page: Page) {
  return page.locator('.driver-popover');
}

async function next(page: Page, title: string) {
  await tourPopover(page).getByRole('button', { name: 'Siguiente' }).click();
  await expect(tourPopover(page).locator('.driver-popover-title')).toHaveText(title);
}

function receivesPointerAtCenter(locator: Locator) {
  return locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return element.contains(
      document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
    );
  });
}

async function separated(a: Locator, b: Locator) {
  const [first, second] = await Promise.all([a.boundingBox(), b.boundingBox()]);
  if (!first || !second) return false;
  return (
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

test('the tour keeps its exit, dialogs and feedback usable around the steps', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/practice-roadmap/student');
  await expect(tourPopover(page).locator('.driver-popover-title')).toHaveText(
    'Muévete por el mapa',
  );

  await page.locator('.react-flow__node').filter({ hasText: 'Conceptos básicos' }).click();
  const panel = page.locator('#student-node-detail-panel');
  await expect(panel).toBeVisible();
  const exit = page.getByRole('link', { name: 'Salir', exact: true });
  await expect
    .poll(async () => {
      const [exitBox, panelBox] = await Promise.all([exit.boundingBox(), panel.boundingBox()]);
      return Boolean(exitBox && panelBox && exitBox.x + exitBox.width <= panelBox.x);
    })
    .toBe(true);
  await page.screenshot({ path: 'test-results/tutorial-engine-exit-beside-panel.png' });

  await next(page, 'Centrar mapa');
  await expect(panel).toBeHidden();

  await page.goto('/practice-roadmap/teaching');
  await expect(tourPopover(page).locator('.driver-popover-title')).toHaveText(
    'Muévete por el mapa',
  );
  await next(page, 'Centrar mapa');
  for (const title of ['Nodos', 'Nodo oculto', 'Nodo bloqueado', 'Crea un nodo'])
    await next(page, title);

  await page.getByRole('button', { name: 'Crear en el mapa' }).click();
  await page.getByRole('menuitem', { name: 'Crear nodo' }).click();
  const dialog = page.getByRole('dialog', { name: 'Crear nodo' });
  await expect(dialog).toHaveClass(/driver-active-element/);
  await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCSS('backdrop-filter', 'none');
  await expect.poll(() => receivesPointerAtCenter(dialog)).toBe(true);
  for (const button of ['Cancelar', 'Crear nodo'])
    await expect
      .poll(() => separated(tourPopover(page), dialog.getByRole('button', { name: button })))
      .toBe(true);

  await dialog.getByLabel('Título').fill('Nodo de práctica');
  await dialog.getByLabel('Título').press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('alertdialog', { name: '¿Salir del tutorial?' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Crear en el mapa' }).click();
  await page.getByRole('menuitem', { name: 'Crear nodo' }).click();
  await dialog.getByLabel('Título').fill('Nodo de práctica');
  await dialog.getByRole('button', { name: 'Crear nodo' }).click();
  await expect(tourPopover(page).locator('.driver-popover-title')).toHaveText('Tipos de nodo');
  const feedback = page.locator('[data-slot="toast"]').filter({ hasText: 'Nodo creado' });
  await expect(feedback).toBeVisible();
  await expect.poll(() => receivesPointerAtCenter(feedback.locator('button'))).toBe(true);
  await expect.poll(() => separated(feedback, tourPopover(page))).toBe(true);
  await page.screenshot({ path: 'test-results/tutorial-engine-feedback.png' });
});

test('a student detail stays highlighted when the layout switches to mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/practice-roadmap/student');
  for (const title of [
    'Centrar mapa',
    'Nodos',
    'Nodo completado',
    'Nodo pendiente',
    'Bloqueado por dependencias',
    'Bloqueado por el equipo docente',
    'Cambios sin revisar',
    'Detalle del nodo',
  ])
    await next(page, title);
  const detail = page.locator('#student-node-detail-panel');
  await expect(detail).toHaveClass(/driver-active-element/);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(detail).toHaveAttribute('data-slot', 'sheet-content');
  await expect(detail).toHaveClass(/driver-active-element/);
  await expect(tourPopover(page).getByRole('button', { name: 'Siguiente' })).toBeEnabled();
  await expect.poll(() => receivesPointerAtCenter(page.locator('[data-tutorial-exit]'))).toBe(true);
});
