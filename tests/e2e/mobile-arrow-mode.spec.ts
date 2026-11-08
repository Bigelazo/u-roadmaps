import type { CDPSession, Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { ok } from './helpers';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

type Point = { x: number; y: number };

async function center(locator: Locator): Promise<Point> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Touch surface is not visible.');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function touch(
  client: CDPSession,
  type: 'touchStart' | 'touchMove' | 'touchEnd',
  point?: Point,
) {
  await client.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: point ? [{ ...point, id: 1, radiusX: 2, radiusY: 2, force: 1 }] : [],
  });
}

async function openPractice(page: Page) {
  await page.goto('/practice-roadmap/teaching');
  await expect(page.locator('.driver-popover')).toBeVisible();
  await page.keyboard.press('Escape');
  await page
    .getByRole('alertdialog', { name: '¿Salir del tutorial?' })
    .getByRole('button', { name: 'Salir' })
    .tap();
  await expect(page.locator('.driver-popover')).toHaveCount(0);
  await expect(page.locator('.react-flow__edge')).toHaveCount(8);
}

async function panCanvas(page: Page, client: CDPSession, delta: { x: number; y: number }) {
  const start = await page.locator('.react-flow').evaluate((element) => {
    const box = element.getBoundingClientRect();
    for (let y = box.y + 40; y < box.bottom - 80; y += 30) {
      for (let x = box.x + 50; x < box.right - 50; x += 30) {
        const hit = document.elementFromPoint(x, y);
        if (hit?.classList.contains('react-flow__pane')) return { x, y };
      }
    }
    throw new Error('No empty canvas surface is available for native panning.');
  });
  await touch(client, 'touchStart', start);
  for (let step = 1; step <= 6; step++) {
    await touch(client, 'touchMove', {
      x: start.x + (delta.x * step) / 6,
      y: start.y + (delta.y * step) / 6,
    });
  }
  await touch(client, 'touchEnd');
}

async function settleViewport(page: Page) {
  let previous = '';
  let stableSince = Date.now();
  await expect
    .poll(async () => {
      const transform = await page
        .locator('.react-flow__viewport')
        .evaluate((element) => element.style.transform);
      if (transform !== previous) {
        previous = transform;
        stableSince = Date.now();
      }
      return Date.now() - stableSince;
    })
    .toBeGreaterThan(200);
}

async function centerOverview(page: Page) {
  await page.getByRole('button', { name: 'Centrar mapa', exact: true }).tap();
  await settleViewport(page);
  const canvas = await center(page.locator('.react-flow'));
  await page.mouse.move(canvas.x, canvas.y);
  await page.mouse.wheel(0, 900);
  await expect
    .poll(() =>
      page
        .locator('.react-flow__viewport')
        .evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).a),
    )
    .toBeLessThan(0.3);
  await settleViewport(page);
}

async function centerPracticePair(page: Page, client: CDPSession) {
  const source = page.locator('.react-flow__node[data-id="practice-node-a"]');
  const target = page.locator('.react-flow__node[data-id="practice-node-d"]');
  const canvas = await page.locator('.react-flow').boundingBox();
  if (!canvas) throw new Error('Practice canvas is not visible.');
  await centerOverview(page);
  const from = await center(source.locator('p'));
  const to = await center(target.locator('p'));
  const delta = {
    x: canvas.x + canvas.width / 2 - (from.x + to.x) / 2,
    y: canvas.y + canvas.height / 2 - (from.y + to.y) / 2,
  };
  await panCanvas(page, client, delta);
  const sourcePoint = await center(source.locator('p'));
  const targetPoint = await center(target.locator('p'));
  for (const point of [sourcePoint, targetPoint]) {
    expect(point.x).toBeGreaterThan(canvas.x);
    expect(point.x).toBeLessThan(canvas.x + canvas.width);
    expect(point.y).toBeGreaterThan(canvas.y);
    expect(point.y).toBeLessThan(canvas.y + canvas.height);
  }
  return { source, target };
}

const modeMessage = (page: Page) =>
  page.getByText('Modo flecha: toca un nodo de destino', { exact: true });

async function armArrowMode(page: Page, client: CDPSession, source: Locator) {
  await touch(client, 'touchStart', await center(source.locator('p')));
  try {
    await expect(modeMessage(page)).toBeVisible();
  } finally {
    await touch(client, 'touchEnd');
  }
  await expect(modeMessage(page)).toBeVisible();
}

for (const width of [390, 360]) {
  test(`native touch arrow mode connects and cancels without replacing taps or panning at ${width}px`, async ({
    page,
  }, testInfo) => {
    const passiveTouchErrors: string[] = [];
    page.on('console', (message) => {
      if (/passive event listener/i.test(message.text())) passiveTouchErrors.push(message.text());
    });
    await page.setViewportSize({ width, height: 844 });
    await ok(
      await page.request.post('/api/development/session', {
        data: { userId: '10000000-0000-4000-8000-000000000001' },
      }),
    );
    const client = await page.context().newCDPSession(page);
    try {
      await openPractice(page);
      const { source, target } = await centerPracticePair(page, client);

      await source.locator('p').tap();
      await expect(page.locator('#roadmap-editor-panel')).toBeVisible();
      await expect(modeMessage(page)).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(page.locator('#roadmap-editor-panel')).toBeHidden();

      await armArrowMode(page, client, source);
      await expect(source).toHaveClass(/roadmap-node--arrow-source/);
      await expect(page.locator('#roadmap-editor-panel')).toBeHidden();
      await page.screenshot({ path: testInfo.outputPath(`arrow-mode-${width}.png`) });
      await page.getByRole('button', { name: 'Cancelar modo flecha', exact: true }).tap();
      await expect(modeMessage(page)).toHaveCount(0);
      await expect(page.locator('.react-flow__edge')).toHaveCount(8);

      await armArrowMode(page, client, source);
      await target.locator('p').tap();
      await expect(page.locator('.react-flow__edge')).toHaveCount(9);
      await expect(modeMessage(page)).toHaveCount(0);
      await expect(page.locator('#roadmap-editor-panel')).toBeHidden();
      await page.screenshot({ path: testInfo.outputPath(`arrow-created-${width}.png`) });

      await openPractice(page);
      const continuous = await centerPracticePair(page, client);
      const heldFrom = await center(continuous.source.locator('p'));
      const heldTo = await center(continuous.target.locator('p'));
      const heldSourceTransform = await continuous.source.evaluate(
        (element) => element.style.transform,
      );
      await touch(client, 'touchStart', heldFrom);
      await expect(modeMessage(page)).toBeVisible();
      for (let step = 1; step <= 6; step++) {
        await touch(client, 'touchMove', {
          x: heldFrom.x + ((heldTo.x - heldFrom.x) * step) / 6,
          y: heldFrom.y + ((heldTo.y - heldFrom.y) * step) / 6,
        });
      }
      await expect(continuous.target).toHaveClass(/roadmap-node--connection-target/);
      const preview = page.locator('.react-flow__connection-path');
      await expect(preview).toHaveAttribute('d', /^M/);
      const previewPath = await preview.getAttribute('d');
      expect(await continuous.source.evaluate((element) => element.style.transform)).toBe(
        heldSourceTransform,
      );
      await page.screenshot({ path: testInfo.outputPath(`arrow-drag-preview-${width}.png`) });
      await touch(client, 'touchEnd');
      await expect(page.locator('.react-flow__edge')).toHaveCount(9);
      await expect(
        page.locator(
          '.react-flow__edge:not([data-id^="practice-dependency-"]) .react-flow__edge-path',
        ),
      ).toHaveAttribute('d', previewPath!);
      await expect(modeMessage(page)).toHaveCount(0);
      await expect(page.locator('#roadmap-editor-panel')).toBeHidden();

      await openPractice(page);
      const reset = await centerPracticePair(page, client);
      const viewport = page.locator('.react-flow__viewport');
      const initialTransform = await viewport.evaluate((element) => element.style.transform);
      const initialNodeTransform = await reset.source.evaluate(
        (element) => element.style.transform,
      );
      const start = await center(reset.source.locator('p'));
      await touch(client, 'touchStart', start);
      await touch(client, 'touchMove', { x: start.x + 12, y: start.y + 10 });
      await touch(client, 'touchMove', { x: start.x + 35, y: start.y + 30 });
      await touch(client, 'touchMove', { x: start.x + 50, y: start.y + 40 });
      // eslint-disable-next-line playwright/no-wait-for-timeout -- Native hold duration is the behavior under test.
      await page.waitForTimeout(600);
      await expect(modeMessage(page)).toHaveCount(0);
      await touch(client, 'touchEnd');
      await expect
        .poll(
          async () =>
            (await viewport.evaluate((element) => element.style.transform)) !== initialTransform ||
            (await reset.source.evaluate((element) => element.style.transform)) !==
              initialNodeTransform,
        )
        .toBe(true);
      await expect(page.locator('.react-flow__edge')).toHaveCount(8);

      await openPractice(page);
      const fresh = await centerPracticePair(page, client);
      await fresh.source.focus();
      const trigger = fresh.source.getByRole('button', { name: 'Abrir menú de acciones del nodo' });
      await touch(client, 'touchStart', await center(trigger));
      // eslint-disable-next-line playwright/no-wait-for-timeout -- Hold the excluded button beyond the real arming threshold.
      await page.waitForTimeout(600);
      await expect(modeMessage(page)).toHaveCount(0);
      await touch(client, 'touchEnd');
      const actions = page.getByRole('dialog', { name: 'Menú de acciones del nodo' });
      await expect(modeMessage(page)).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(actions).toBeHidden();
      await fresh.source.focus();
      await trigger.tap();
      await expect(actions).toBeVisible();
      await actions.getByRole('button', { name: 'Cerrar acciones' }).tap();
      expect(passiveTouchErrors).toEqual([]);
    } finally {
      await touch(client, 'touchEnd').catch(() => undefined);
      await client.detach();
    }
  });
}

test('touch Arrow mode reaches Nodes under its banner on a landscape phone', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await ok(
    await page.request.post('/api/development/session', {
      data: { userId: '10000000-0000-4000-8000-000000000001' },
    }),
  );
  const client = await page.context().newCDPSession(page);
  try {
    await openPractice(page);
    const source = page.locator('.react-flow__node[data-id="practice-node-a"]');
    const target = page.locator('.react-flow__node[data-id="practice-node-d"]');

    const canvas = await page.locator('.react-flow').boundingBox();
    if (!canvas) throw new Error('Practice canvas is not visible.');
    const start = await center(source.locator('p'));
    await panCanvas(page, client, {
      x: canvas.x + canvas.width / 2 - start.x,
      y: canvas.y + canvas.height * 0.75 - start.y,
    });

    await armArrowMode(page, client, source);
    const underMessage = await center(modeMessage(page));
    await page.getByRole('button', { name: 'Cancelar modo flecha', exact: true }).tap();

    async function panUnderMessage(node: Locator) {
      const point = await center(node.locator('p'));
      await panCanvas(page, client, {
        x: underMessage.x - point.x,
        y: underMessage.y - point.y,
      });
      await expect
        .poll(async () => {
          const moved = await center(node.locator('p'));
          return Math.hypot(moved.x - underMessage.x, moved.y - underMessage.y) < 8;
        })
        .toBe(true);
    }

    await panUnderMessage(source);
    await armArrowMode(page, client, source);
    await expect(modeMessage(page)).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar modo flecha', exact: true }).tap();

    const viewport = page.locator('.react-flow__viewport');
    const readable = await viewport.evaluate((element) => element.style.transform);
    await centerOverview(page);
    await expect
      .poll(() => viewport.evaluate((element) => element.style.transform))
      .not.toBe(readable);
    await panUnderMessage(target);
    await armArrowMode(page, client, source);
    await touch(client, 'touchStart', underMessage);
    await touch(client, 'touchEnd');
    await expect(page.locator('.react-flow__edge')).toHaveCount(9);
    await expect(modeMessage(page)).toHaveCount(0);
  } finally {
    await touch(client, 'touchEnd').catch(() => undefined);
    await client.detach();
  }
});
