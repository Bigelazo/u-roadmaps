import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { authenticateAs, ok } from './helpers';
import { prepareNodeCreator } from './create-node';

async function bounds(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Connection surface is not visible.');
  return box;
}

async function expectSettled(locator: Locator) {
  let previous: Awaited<ReturnType<typeof bounds>> | undefined;
  await expect
    .poll(async () => {
      const current = await bounds(locator);
      const settled = previous?.width === current.width && previous.height === current.height;
      previous = current;
      return settled;
    })
    .toBe(true);
}

async function center(locator: Locator) {
  const box = await bounds(locator);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function dragToNodeBody(page: Page, source: Locator, target: Locator) {
  await source.getByTestId('roadmap-card').hover();
  const port = source.locator('[data-node-connector="right"]');
  await expect(port).toHaveCSS('visibility', 'visible');
  const start = await center(port);
  const end = await center(target.locator('p'));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
}

test('the connector creates a saved Dependency by dropping on the target title', async ({
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
  await expectSettled(card);
  const port = source.locator('[data-node-connector="right"]');
  await page.mouse.move(0, 0);
  await expect(port).toHaveCSS('visibility', 'hidden');
  await expect(port).toHaveCSS('pointer-events', 'none');
  const initialNodeTransform = await source.evaluate((element) => element.style.transform);
  const restingPort = await center(port);
  await page.mouse.move(restingPort.x, restingPort.y);
  await expect(card).not.toHaveAttribute('data-connection-hovered', 'true');
  await page.mouse.down();
  await page.mouse.move(restingPort.x + 75, restingPort.y + 20, { steps: 6 });
  await expect(page.locator('.react-flow__connection-path')).toHaveCount(0);
  await page.mouse.up();
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  expect(await source.evaluate((element) => element.style.transform)).toBe(initialNodeTransform);

  await page.mouse.move(0, 0);
  await card.hover();
  await expect(card).toHaveAttribute('data-connection-hovered', 'true');
  await expect(port).toHaveCSS('visibility', 'visible');
  await expect(port).toHaveCSS('pointer-events', 'auto');
  await expect(port).toHaveAccessibleName('Agregar un nodo que requiera Prerrequisito de conexión');
  const cardBounds = await bounds(card);
  const portBounds = await bounds(port);
  expect(
    portBounds.x + portBounds.width / 2,
    'The connector circle sits outside the card',
  ).toBeGreaterThan(cardBounds.x + cardBounds.width + 10);
  await page.mouse.move(portBounds.x + portBounds.width / 2, portBounds.y + portBounds.height / 2);
  await expect(card).toHaveAttribute('data-connection-hovered', 'true');
  await expect(port).toHaveCSS('cursor', 'pointer');
  expect(
    await port.evaluate((element) => getComputedStyle(element, '::before').backgroundColor),
    'The connector disc stays opaque so grid and edge lines never cross it',
  ).not.toMatch(/\/|rgba|transparent/);
  await expect(page.getByText('Arrastrar dependencia')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('connection-port-hover-desktop.png') });
  await page.mouse.move(0, 0);
  await expect(port).toHaveCSS('pointer-events', 'none');
  await expect(card).not.toHaveAttribute('data-connection-hovered', 'true');

  await dragToNodeBody(page, source, target);
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

  await dragToNodeBody(page, target, source);
  await expect(source).toHaveClass(/roadmap-node--connection-rejected/);
  await expect(source).not.toHaveClass(/roadmap-node--connection-target/);
  await expect(source.getByTestId('roadmap-card')).toHaveCSS('outline-style', 'dashed');
  await page.mouse.up();
  await expect(page.locator('[data-slot="toast-title"][data-type="error"]')).toHaveText(
    'Prerrequisito de conexión ya es prerrequisito de Destino de conexión y se formaría un ciclo.',
  );
  await expect(source).not.toHaveClass(/roadmap-node--connection-rejected/);
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

test('clicking the connector and then a Node creates the Dependency without dragging', async ({
  page,
  course,
  createCourse,
  teacherApi,
}) => {
  const empty = await createCourse({
    roadmap: false,
    participants: [{ user: course.users.teacher, role: 'TEACHER' }],
  });
  await ok(await teacherApi.post(empty.apiPath(), { data: {} }), 201);
  const creator = await prepareNodeCreator(teacherApi, empty);
  const origin = await creator.createNode('Origen por clic', 0);
  const destination = await creator.createNode('Destino por clic', 360);

  await page.setViewportSize({ width: 1440, height: 900 });
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(empty.pagePath());
  const source = page.locator(`.react-flow__node[data-id="${origin.id}"]`);
  const target = page.locator(`.react-flow__node[data-id="${destination.id}"]`);
  await expectSettled(source.getByTestId('roadmap-card'));
  await source.getByTestId('roadmap-card').hover();
  await source.locator('[data-node-connector="right"]').click();
  const banner = page.locator('[data-arrow-mode-controls] [role="status"]');
  await expect(banner).toContainText('Haz clic en el nodo que requiere Origen por clic');
  await expect(page.locator('#roadmap-editor-panel')).toBeHidden();
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().endsWith('/dependencies'),
  );
  await target.locator('p').click();
  expect((await saved).status()).toBe(201);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await expect(banner).toHaveCount(0);

  await target.getByTestId('roadmap-card').click();
  await page.mouse.move(0, 0);
  await expect(target).toHaveClass(/selected/);
  await expect(target.locator('[data-node-connector="right"]')).toHaveCSS('visibility', 'hidden');
});
