import type { Locator } from '@playwright/test';
import { expect, test } from './fixtures';
import { ok } from './helpers';

async function bounds(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Routing scenario surface is not visible.');
  return box;
}

test('a valid-target preview matches its persisted obstacle route with source fanout', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
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
  await expect(page.locator('.driver-popover')).toHaveCount(0);

  const edges = page.locator('.react-flow__edge');
  await expect(edges).toHaveCount(8);
  const originalPaths = await edges
    .locator('.react-flow__edge-path')
    .evaluateAll((paths) => paths.map((path) => path.getAttribute('d')));
  const originalIds = await edges.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-id')),
  );
  const source = page.locator('.react-flow__node[data-id="practice-node-a"]');
  const target = page.locator('.react-flow__node[data-id="practice-node-d"]');
  const obstacle = page.locator(
    '.react-flow__node[data-id="practice-node-b"] [data-slot="roadmap-card"]',
  );
  await expect(obstacle).toBeVisible();
  await expect(target.getByTestId('roadmap-card')).toHaveCSS('transform', 'none');
  await source.getByTestId('roadmap-card').hover();
  const from = await bounds(source.locator('.react-flow__handle-right'));
  const to = await bounds(target.locator('p'));
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await expect(target).toHaveClass(/roadmap-node--connection-target/);
  const preview = page.locator('.react-flow__connection-path');
  await expect(preview).toHaveCount(1);
  await expect(preview).toHaveAttribute('d', /.+/);
  const previewPath = await preview.getAttribute('d');
  expect(
    await edges
      .locator('.react-flow__edge-path')
      .evaluateAll((paths) => paths.map((path) => path.getAttribute('d'))),
  ).toEqual(originalPaths);
  await page.mouse.move(to.x + to.width / 2 + 2, to.y + to.height / 2 + 2);
  await expect(preview).toHaveAttribute('d', previewPath!);
  await page.mouse.up();
  await expect(edges).toHaveCount(9);

  const newId = await edges.evaluateAll(
    (elements, initialIds) =>
      elements
        .map((element) => element.getAttribute('data-id'))
        .find((id) => id !== null && !initialIds.includes(id)),
    originalIds,
  );
  expect(newId).toBeTruthy();
  const path = page.locator(`.react-flow__edge[data-id="${newId}"] .react-flow__edge-path`);
  await expect(path).toHaveCount(1);
  await expect(path).toHaveAttribute('d', previewPath!);
  await expect
    .poll(async () => Number.parseFloat((await path.getAttribute('stroke-dasharray')) ?? '0'))
    .toBe(1);
  await page
    .locator('.react-flow')
    .screenshot({ path: testInfo.outputPath('dependency-around-node.png') });

  await expect
    .poll(
      () =>
        path.evaluate((element) => {
          const route = element as SVGPathElement;
          const matrix = route.getScreenCTM();
          const body = document.querySelector<HTMLElement>(
            '.react-flow__node[data-id="practice-node-b"] [data-slot="roadmap-card"]',
          );
          if (!matrix || !body) throw new Error('Rendered routing geometry is unavailable.');
          const box = body.getBoundingClientRect();
          const length = route.getTotalLength();
          if (length <= 0) throw new Error('Dependency route has no rendered length.');
          let intersections = 0;
          for (let distance = 0; distance <= length; distance += 1) {
            const point = route.getPointAtLength(distance).matrixTransform(matrix);
            if (
              point.x > box.left + 1 &&
              point.x < box.right - 1 &&
              point.y > box.top + 1 &&
              point.y < box.bottom - 1
            )
              intersections++;
          }
          return intersections;
        }),
      { message: 'A Dependency must not pass through the intermediate Node body' },
    )
    .toBe(0);
});
