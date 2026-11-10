import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { ok } from './helpers';

async function centerLargeRoadmap(page: Page) {
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
  await expect(page.locator('.react-flow__node')).toHaveCount(8);
  await page.getByRole('button', { name: 'Centrar mapa', exact: true }).click();
}

for (const viewport of [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`centering a large Roadmap preserves readable Nodes at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await centerLargeRoadmap(page);
    await expect
      .poll(() =>
        page.locator('.react-flow__viewport').evaluate((element) => {
          const zoom = new DOMMatrixReadOnly(getComputedStyle(element).transform).a;
          const title = element.querySelector('p');
          return title ? parseFloat(getComputedStyle(title).fontSize) * zoom : 0;
        }),
      )
      .toBeGreaterThanOrEqual(12);

    await page.screenshot({ path: testInfo.outputPath(`center-map-${viewport.width}.png`) });
  });
}

test('centering a large Roadmap preserves the whole map at 1440px', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await centerLargeRoadmap(page);
  const canvas = await page.locator('.react-flow').boundingBox();
  expect(canvas).not.toBeNull();
  for (const node of await page.locator('.react-flow__node').all()) {
    const bounds = await node.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(canvas!.x);
    expect(bounds!.y).toBeGreaterThanOrEqual(canvas!.y);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(canvas!.x + canvas!.width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(canvas!.y + canvas!.height);
  }
  await page.screenshot({ path: testInfo.outputPath('center-map-1440.png') });
});
