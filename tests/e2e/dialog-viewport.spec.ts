import type { CDPSession, Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { ok } from './helpers';

test.use({ hasTouch: true, isMobile: true });

async function openPractice(page: Page) {
  await ok(
    await page.request.post('/api/development/session', {
      data: { userId: '10000000-0000-4000-8000-000000000001' },
    }),
  );
  await page.goto('/practice-roadmap/teaching');
  await expect(page.locator('.driver-popover')).toBeVisible();
  await page.keyboard.press('Escape');
  await page
    .getByRole('alertdialog', { name: '¿Salir del tutorial?' })
    .getByRole('button', { name: 'Salir', exact: true })
    .tap();
  await expect(page.locator('.driver-popover')).toHaveCount(0);
}

async function expectWithinViewport(dialog: Locator, height: number) {
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height);
}

async function swipeUp(client: CDPSession, dialog: Locator) {
  const bounds = (await dialog.boundingBox())!;
  const x = bounds.x + bounds.width - 24;
  const startY = bounds.y + bounds.height - 36;
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y: startY, id: 1 }],
  });
  for (let step = 1; step <= 8; step++) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: startY - ((bounds.height - 80) * step) / 8, id: 1 }],
    });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

for (const viewport of [
  { width: 844, height: 390, label: 'landscape' },
  { width: 390, height: 490, label: 'simulated-keyboard' },
]) {
  test(`Node creation stays reachable by native touch in ${viewport.label}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await openPractice(page);
    await page.getByRole('button', { name: 'Crear en el mapa', exact: true }).tap();
    await page.getByRole('menuitem', { name: 'Crear nodo', exact: true }).tap();
    const dialog = page.getByRole('dialog', { name: 'Agregar al mapa' });
    await expect(dialog).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${viewport.label}-title.png`) });
    await expectWithinViewport(dialog, viewport.height);
    const title = dialog.getByRole('textbox', { name: 'Título', exact: true });
    await expect(title).toBeInViewport({ ratio: 1 });
    await title.fill(`Nodo ${viewport.label}`);
    const client = await page.context().newCDPSession(page);
    try {
      const initialScroll = await dialog.evaluate((element) => element.scrollTop);
      for (let swipe = 0; swipe < 3; swipe++) await swipeUp(client, dialog);
      await expect
        .poll(() => dialog.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(initialScroll);
      const submit = dialog.getByRole('button', { name: 'Agregar nodo', exact: true });
      await expect(submit).toBeInViewport({ ratio: 1 });
      await page.screenshot({ path: testInfo.outputPath(`${viewport.label}-submit.png`) });
      await submit.tap();
      await expect(dialog).toBeHidden();
      await expect(
        page.locator('.react-flow__node').filter({ hasText: `Nodo ${viewport.label}` }),
      ).toBeVisible();
    } finally {
      await client.detach();
    }
  });
}

test('shared Dialog preserves desktop sizing and other consumers on a short viewport', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openPractice(page);
  const create = page.getByRole('button', { name: 'Crear en el mapa', exact: true });
  await create.tap();
  await page.getByRole('menuitem', { name: 'Crear nodo', exact: true }).tap();
  const creator = page.getByRole('dialog', { name: 'Agregar al mapa' });
  await expect(creator.getByRole('textbox', { name: 'Título', exact: true })).toBeFocused();
  await expectWithinViewport(creator, 900);
  await expect.poll(async () => (await creator.boundingBox())!.width).toBe(384);
  await expect(creator.getByRole('button', { name: 'Agregar nodo', exact: true })).toBeInViewport({
    ratio: 1,
  });
  await page.screenshot({ path: testInfo.outputPath('desktop.png') });
  await page.keyboard.press('Escape');
  await expect(creator).toBeHidden();
  await expect(create).toBeFocused();
  await page.setViewportSize({ width: 844, height: 390 });
  await create.tap();
  await page.getByRole('menuitem', { name: 'Gestionar tipos de nodo', exact: true }).tap();
  const types = page.getByRole('dialog', { name: 'Tipos de nodo', exact: true });
  await expect(types).toBeVisible();
  await expectWithinViewport(types, 390);
  await page.screenshot({ path: testInfo.outputPath('node-types.png') });
  await types.getByRole('button', { name: 'Close', exact: true }).tap();
  await expect(types).toBeHidden();
  await page.getByRole('button', { name: 'Centrar mapa', exact: true }).tap();
  const introduction = page
    .locator('.react-flow__node[data-id="practice-node-a"]')
    .getByText('Introducción', { exact: true });
  const canvas = (await page.locator('.react-flow').boundingBox())!;
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await page.mouse.wheel(0, 900);
  await expect
    .poll(() =>
      introduction.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return element.contains(
          document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2),
        );
      }),
    )
    .toBe(true);
  await introduction.tap();
  await page.getByRole('button', { name: 'Editar nodo en pantalla completa', exact: true }).tap();
  const fullscreen = page
    .getByRole('dialog')
    .filter({ has: page.getByRole('button', { name: 'Cerrar pantalla completa' }) });
  await expect(fullscreen).toBeVisible();
  await expectWithinViewport(fullscreen, 390);
  await expect(fullscreen).toHaveCSS('opacity', '1');
  await page.screenshot({ path: testInfo.outputPath('fullscreen.png') });
  await fullscreen.getByRole('button', { name: 'Cerrar pantalla completa' }).tap();
  await expect(fullscreen).toBeHidden();
});
