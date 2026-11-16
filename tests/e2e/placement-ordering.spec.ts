import type { Locator } from '@playwright/test';
import { expect, test } from './fixtures';
import { authenticateAs, toast } from './helpers';

type Position = { x: number; y: number };
type Placement = { nodeId: string; position: Position };

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

function transform({ x, y }: Position) {
  return `matrix(1, 0, 0, 1, ${x}, ${y})`;
}

async function displayedPosition(node: Locator) {
  return node.evaluate((element) => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform);
    return { x: matrix.m41, y: matrix.m42 };
  });
}

test('rapid gestures keep their newer visual position while the earlier placement refreshes', async ({
  page,
  course,
  apiAs,
}) => {
  const api = await apiAs(course.users.teacher);
  const firstSubmitted = deferred();
  const secondSubmitted = deferred();
  const releaseFirst = deferred();
  const releaseSecond = deferred();
  let firstPosition!: Position;
  let submissions = 0;
  await page.route(`**${course.apiPath('/placement')}`, async (route) => {
    submissions += 1;
    if (submissions === 1) {
      firstPosition = route
        .request()
        .postDataJSON()
        .positions.find(({ nodeId }: Placement) => nodeId === course.nodes.first).position;
      firstSubmitted.resolve();
      await releaseFirst.promise;
    } else if (submissions === 2) {
      secondSubmitted.resolve();
      await releaseSecond.promise;
    }
    await route.continue();
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(course.pagePath());
  const node = page.locator(`.react-flow__node[data-id="${course.nodes.first}"]`);
  await node.click();
  await node.focus();
  try {
    await node.press('Shift+ArrowRight');
    await firstSubmitted.promise;
    await expect(node).toHaveCSS('transform', transform(firstPosition));
    await node.press('Shift+ArrowRight');
    await expect(node).not.toHaveCSS('transform', transform(firstPosition));
    const newerPosition = await displayedPosition(node);
    expect(submissions).toBe(1);
    releaseFirst.resolve();
    await secondSubmitted.promise;
    await expect(node).toHaveCSS('transform', transform(newerPosition));
    const intermediate = await (await api.get(course.apiPath())).json();
    expect(
      intermediate.nodes.find(({ id }: { id: string }) => id === course.nodes.first),
    ).toMatchObject({ positionX: firstPosition.x, positionY: firstPosition.y });
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith(course.apiPath('/placement')) &&
        response.request().method() === 'PATCH',
    );
    releaseSecond.resolve();
    expect((await saved).status()).toBe(204);
    await expect
      .poll(async () => {
        const current = await (await api.get(course.apiPath())).json();
        const savedNode = current.nodes.find(({ id }: { id: string }) => id === course.nodes.first);
        return { x: savedNode.positionX, y: savedNode.positionY };
      })
      .toEqual(newerPosition);
  } finally {
    releaseFirst.resolve();
    releaseSecond.resolve();
    await page.unrouteAll({ behavior: 'wait' });
  }
});

test('a rejected rapid gesture discards dependent work and resumes from the latest saved Roadmap', async ({
  page,
  course,
  apiAs,
}, testInfo) => {
  const colleague = await apiAs(course.users.teacher);
  const submitted = deferred();
  const release = deferred();
  let firstPosition!: Position;
  let submissions = 0;
  await page.route(`**${course.apiPath('/placement')}`, async (route) => {
    submissions += 1;
    if (submissions !== 1) return route.continue();
    firstPosition = route
      .request()
      .postDataJSON()
      .positions.find(({ nodeId }: Placement) => nodeId === course.nodes.first).position;
    submitted.resolve();
    await release.promise;
    const changed = await colleague.patch(course.apiPath(`/nodes/${course.nodes.first}`), {
      data: { positionX: 60, positionY: 0 },
    });
    expect(changed.ok()).toBe(true);
    await route.fulfill({
      status: 409,
      json: { error: { code: 'CONFLICT', message: 'No se pudo guardar la posición.' } },
    });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(course.pagePath());
  const node = page.locator(`.react-flow__node[data-id="${course.nodes.first}"]`);
  await node.click();
  await node.focus();
  try {
    await node.press('Shift+ArrowRight');
    await submitted.promise;
    await expect(node).toHaveCSS('transform', transform(firstPosition));
    await node.press('Shift+ArrowRight');
    await expect(node).not.toHaveCSS('transform', transform(firstPosition));
    release.resolve();
    const failure = toast(page, 'No se pudo guardar la posición.');
    await expect(failure).toBeVisible();
    await expect(node).toHaveCSS('transform', transform({ x: 60, y: 0 }));
    expect(submissions).toBe(1);
    await failure.hover();
    await expect(failure).toBeInViewport({ ratio: 1 });
    await failure.screenshot({
      path: testInfo.outputPath('rapid-placement-failure.png'),
      animations: 'disabled',
    });
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith(course.apiPath('/placement')) &&
        response.request().method() === 'PATCH',
    );
    await node.focus();
    await node.press('Shift+ArrowRight');
    const response = await saved;
    expect(response.status()).toBe(204);
    expect(submissions).toBe(2);
    const expectedPosition = response
      .request()
      .postDataJSON()
      .positions.find(({ nodeId }: Placement) => nodeId === course.nodes.first).position;
    const current = await (await colleague.get(course.apiPath())).json();
    expect(current.nodes.find(({ id }: { id: string }) => id === course.nodes.first)).toMatchObject(
      { positionX: expectedPosition.x, positionY: expectedPosition.y },
    );
  } finally {
    release.resolve();
    await page.unrouteAll({ behavior: 'wait' });
  }
});
