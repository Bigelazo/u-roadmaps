import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { ok } from './helpers';

async function openLowNode(page: Page) {
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
    .getByRole('button', { name: 'Salir' })
    .click();
  const node = page.locator('.react-flow__node[data-id="practice-node-a"]');
  await expect(node).toBeVisible();
  const start = await page.locator('.react-flow').evaluate((element) => {
    const box = element.getBoundingClientRect();
    for (let y = box.y + 40; y < box.bottom - 80; y += 30) {
      for (let x = box.x + 50; x < box.right - 50; x += 30) {
        if (document.elementFromPoint(x, y)?.classList.contains('react-flow__pane'))
          return { x, y };
      }
    }
    throw new Error('No empty canvas surface is available.');
  });
  const bounds = await node.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(
    start.x + 195 - bounds!.x - bounds!.width / 2,
    start.y + 600 - bounds!.y - bounds!.height / 2,
    { steps: 10 },
  );
  await page.mouse.up();
  await expect.poll(async () => (await node.boundingBox())!.y).toBeGreaterThan(550);
  await node.locator('p').click();
  await expect(page.locator('#roadmap-editor-panel')).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('#roadmap-editor-panel')
        .evaluate((panel) =>
          panel.getAnimations().every((animation) => animation.playState === 'finished'),
        ),
    )
    .toBe(true);
  return node;
}

async function expectNodeAbovePanel(page: Page, node: Locator) {
  await expect
    .poll(async () => {
      const bounds = await node.boundingBox();
      const panel = await page.locator('#roadmap-editor-panel').boundingBox();
      const canvas = await page.locator('.react-flow').boundingBox();
      const header = await page.locator('[data-canvas-overlay="top"]').first().boundingBox();
      return Boolean(
        bounds &&
        panel &&
        canvas &&
        header &&
        bounds.y >= header.y + header.height &&
        bounds.y + bounds.height <= panel.y &&
        bounds.x >= canvas.x &&
        bounds.x + bounds.width <= canvas.x + canvas.width,
      );
    })
    .toBe(true);
}

test('a low selected Node stays above the compact editor as the viewport changes', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const node = await openLowNode(page);
  await expectNodeAbovePanel(page, node);
  await page.screenshot({ path: testInfo.outputPath('selected-node-390.png') });
  await page.setViewportSize({ width: 390, height: 720 });
  await expectNodeAbovePanel(page, node);
  await page.screenshot({ path: testInfo.outputPath('selected-node-390-short.png') });
  await page.setViewportSize({ width: 844, height: 390 });
  await expectNodeAbovePanel(page, node);
  const save = page
    .locator('#roadmap-editor-panel')
    .getByRole('button', { name: 'Guardar cambios', exact: true });
  await save.scrollIntoViewIfNeeded();
  await expect(save).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('selected-node-landscape.png') });
});

test('desktop selection keeps the Node beside its editor and adapts to compact layout', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const node = await openLowNode(page);
  const bounds = await node.boundingBox();
  const panel = await page.locator('#roadmap-editor-panel').boundingBox();
  expect(bounds).not.toBeNull();
  expect(panel).not.toBeNull();
  expect(bounds!.y).toBeGreaterThan(550);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(panel!.x);
  await page.screenshot({ path: testInfo.outputPath('selected-node-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expectNodeAbovePanel(page, node);
});
