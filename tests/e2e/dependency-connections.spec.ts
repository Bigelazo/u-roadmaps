import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { authenticateAs, ok } from './helpers';
import { prepareNodeCreator } from './create-node';

async function bounds(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Connection surface is not visible.');
  return box;
}

async function center(locator: Locator) {
  const box = await bounds(locator);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function dragToNodeBody(page: Page, source: Locator, target: Locator) {
  await source.getByTestId('roadmap-card').hover();
  await expect(source.getByTestId('roadmap-card')).toHaveAttribute(
    'data-connection-hovered',
    'true',
  );
  const bounds = await source.getByTestId('roadmap-card').boundingBox();
  if (!bounds) throw new Error('Source perimeter is not visible.');
  // Start outside the card and away from the former handle at the side midpoint.
  const start = { x: bounds.x + bounds.width + 3, y: bounds.y + bounds.height / 4 };
  const end = await center(target.locator('p'));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
}

test('the exterior perimeter creates a saved Dependency by dropping on the target title', async ({
  page,
  course,
  createCourse,
  teacherApi,
}, testInfo) => {
  const empty = await createCourse({
    roadmap: false,
    participants: [{ user: course.users.teacher, role: 'TEACHER' }],
  });
  await ok(await teacherApi.post(empty.apiPath(), { data: {} }), 201);
  const creator = await prepareNodeCreator(teacherApi, empty);
  const origin = await creator.createNode('Prerrequisito de conexión', 0);
  const destination = await creator.createNode('Destino de conexión', 360);

  await page.setViewportSize({ width: 1440, height: 900 });
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(empty.pagePath());
  const source = page.locator(`.react-flow__node[data-id="${origin.id}"]`);
  const target = page.locator(`.react-flow__node[data-id="${destination.id}"]`);
  await expect(source).toBeVisible();
  await expect(target).toBeVisible();
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);

  const card = source.getByTestId('roadmap-card');
  const handle = source.locator('.react-flow__handle-right');
  await expect(handle).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(handle).toHaveCSS('opacity', '0');
  expect(await handle.evaluate((element) => getComputedStyle(element, '::after').content)).toMatch(
    /^(none|normal|"")$/,
  );
  await page.mouse.move(0, 0);
  await expect(handle).toHaveCSS('pointer-events', 'none');
  const initialNodeTransform = await source.evaluate((element) => element.style.transform);
  const idleBounds = await bounds(card);
  await page.mouse.move(idleBounds.x + idleBounds.width + 3, idleBounds.y + idleBounds.height / 4);
  await expect(handle).toHaveCSS('pointer-events', 'none');
  await expect(card).not.toHaveAttribute('data-connection-hovered', 'true');
  // Approaching the idle exterior directly must pan the pane rather than launch
  // a Dependency or move a Node. No body hover has armed this surface yet.
  await page.mouse.down();
  await page.mouse.move(
    idleBounds.x + idleBounds.width + 75,
    idleBounds.y + idleBounds.height / 4 + 20,
    { steps: 6 },
  );
  await expect(page.locator('.react-flow__connection-path')).toHaveCount(0);
  await expect(card).not.toHaveAttribute('data-connection-hovered', 'true');
  await page.mouse.up();
  await expect(page.locator('.react-flow__connection-path')).toHaveCount(0);
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  expect(await source.evaluate((element) => element.style.transform)).toBe(initialNodeTransform);

  await page.mouse.move(0, 0);
  const normalShadow = await card.evaluate((element) => getComputedStyle(element).boxShadow);
  await card.hover();
  await expect(card).toHaveAttribute('data-connection-hovered', 'true');
  await expect(handle).toHaveCSS('pointer-events', 'auto');
  await expect
    .poll(() => card.evaluate((element) => getComputedStyle(element).boxShadow))
    .not.toBe(normalShadow);
  // Wait for the actual CSS transition, rather than capturing its first changed frame.
  await card.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
  const shadows = await card.evaluate((element) => getComputedStyle(element).boxShadow);
  for (const shadow of shadows.split(/,(?![^(]*\))/)) {
    const pixels = shadow.match(/-?\d+(?:\.\d+)?px/g)?.map(Number.parseFloat) ?? [];
    expect(
      pixels[2],
      'The connection affordance should blur outward rather than form a hard ring',
    ).toBeGreaterThan(0);
  }
  const armedBounds = await bounds(card);
  await page.mouse.move(
    armedBounds.x + armedBounds.width + 3,
    armedBounds.y + armedBounds.height / 4,
  );
  await expect(card).toHaveAttribute('data-connection-hovered', 'true');
  await expect(handle).toHaveCSS('pointer-events', 'auto');
  await page.screenshot({ path: testInfo.outputPath('connection-perimeter-hover-desktop.png') });
  await page.mouse.move(0, 0);
  await expect(handle).toHaveCSS('pointer-events', 'none');
  await expect(card).not.toHaveAttribute('data-connection-hovered', 'true');

  await dragToNodeBody(page, source, target);
  // A straight SVG path has zero bounding-box height despite its visible stroke.
  await expect(page.locator('.react-flow__connection-path')).toHaveAttribute('d', /^M/);
  await expect(target).toHaveClass(/roadmap-node--connection-target/);
  await page.screenshot({ path: testInfo.outputPath('connection-preview-desktop.png') });
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().endsWith('/dependencies'),
  );
  await page.mouse.up();
  expect((await saved).status()).toBe(201);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await expect(page.locator('#roadmap-editor-panel')).toBeHidden();

  const roadmap = await teacherApi.get(empty.apiPath());
  await ok(roadmap);
  expect((await roadmap.json()).dependencies).toEqual([
    expect.objectContaining({ sourceNodeId: origin.id, targetNodeId: destination.id }),
  ]);
  const edge = page.locator('.react-flow__edge');
  await expect
    .poll(async () =>
      Number.parseFloat(
        (await edge.locator('.react-flow__edge-path').getAttribute('stroke-dasharray')) ?? '0',
      ),
    )
    .toBe(1);
  const tip = await edge.getByTestId('dependency-arrowhead').evaluate((element) => {
    const arrow = element as SVGPathElement;
    const matrix = arrow.getScreenCTM();
    if (!matrix) throw new Error('Arrowhead has no screen transform.');
    // The midpoint of this symmetric open chevron is its visible apex.
    const apex = arrow.getPointAtLength(arrow.getTotalLength() / 2).matrixTransform(matrix);
    const bounds = arrow.getBBox();
    return { x: apex.x, y: apex.y, width: bounds.width, height: bounds.height };
  });
  const targetBounds = await bounds(target.getByTestId('roadmap-card'));
  expect(tip.x).toBeGreaterThanOrEqual(targetBounds.x - 1);
  expect(tip.x).toBeLessThanOrEqual(targetBounds.x + targetBounds.width + 1);
  expect(tip.y).toBeGreaterThanOrEqual(targetBounds.y - 1);
  expect(tip.y).toBeLessThanOrEqual(targetBounds.y + targetBounds.height + 1);
  const borderDistance = Math.min(
    Math.abs(tip.x - targetBounds.x),
    Math.abs(tip.x - targetBounds.x - targetBounds.width),
    Math.abs(tip.y - targetBounds.y),
    Math.abs(tip.y - targetBounds.y - targetBounds.height),
  );
  expect(
    borderDistance,
    'The rendered arrow tip should touch the target Node border',
  ).toBeLessThanOrEqual(1);
  expect(tip.width).toBeGreaterThan(7);
  expect(tip.height).toBeGreaterThan(8);

  // Reversing the relationship would create a cycle and must not create an edge.
  await dragToNodeBody(page, target, source);
  await page.mouse.up();
  await expect(page.locator('.react-flow__connection-path')).toHaveCount(0);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await expect(page.locator('#roadmap-editor-panel')).toBeHidden();

  await page.screenshot({ path: testInfo.outputPath('dependency-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Centrar mapa' }).click();
  await expect(source).toBeInViewport();
  await expect(target).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('dependency-mobile.png') });
});
