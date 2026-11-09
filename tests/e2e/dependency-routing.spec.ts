import type { Page } from '@playwright/test';
import { expect, test, type E2ECourseOffering } from './fixtures';
import { authenticateAs, ok } from './helpers';
import { createDependency } from './create-node';

async function collisions(page: Page, source: string, target: string) {
  return page.locator('.react-flow__edge-path').evaluateAll(
    (paths, { source, target }) => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('.react-flow__node'))
        .filter((node) => node.dataset.id !== source && node.dataset.id !== target)
        .map((node) => node.getBoundingClientRect());
      return paths.flatMap((element) => {
        const path = element as SVGPathElement;
        const matrix = path.getScreenCTM();
        if (!matrix) throw new Error('Dependency has no screen transform');
        const hits = [];
        for (let offset = 0; offset <= path.getTotalLength(); offset += 1) {
          const point = path.getPointAtLength(offset).matrixTransform(matrix);
          if (
            nodes.some(
              (node) =>
                point.x > node.left &&
                point.x < node.right &&
                point.y > node.top &&
                point.y < node.bottom,
            )
          )
            hits.push({ x: point.x, y: point.y });
        }
        return hits;
      });
    },
    { source, target },
  );
}

test('dependencies avoid a third Node throughout dragging, persist after reload, and render for Students', async ({
  page,
  course,
  createCourse,
  teacherApi: api,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const offering: E2ECourseOffering = await createCourse({
    roadmap: false,
    participants: [
      { user: course.users.teacher, role: 'TEACHER' },
      { user: course.users.studentWithoutProgress, role: 'STUDENT' },
    ],
  });
  await ok(await api.post(offering.apiPath(), { data: {} }), 201);
  const types = (await (await api.get(offering.apiPath())).json()).nodeTypes;
  const nodeTypeId = types.find((type: { isPredefined: boolean }) => type.isPredefined).id;
  const ids = [];
  for (const [title, x, y] of [
    ['Inicio', 0, 0],
    ['Destino', 600, 0],
    ['Contenido intermedio', 280, 240],
  ] as const) {
    const response = await ok(
      await api.post(offering.apiPath('/nodes'), {
        data: {
          title,
          nodeTypeId,
          positionX: x,
          positionY: y,
        },
      }),
      201,
    );
    ids.push((await response.json()).node.id as string);
  }
  const [source, target, obstacle] = ids;
  await createDependency(api, offering, source, target);
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(offering.pagePath());
  const edge = page.locator('.react-flow__edge-path');
  await expect(edge).toHaveCount(1);
  const before = await edge.getAttribute('d');
  const node = page.locator(`.react-flow__node[data-id="${obstacle}"]`);
  const origin = (await node.boundingBox())!;
  const sourceBox = (await page.locator(`.react-flow__node[data-id="${source}"]`).boundingBox())!;
  const x = origin.x + origin.width / 2,
    y = origin.y + origin.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(x, y + ((sourceBox.y + sourceBox.height / 2 - y) * i) / 12);
    await expect(edge).toHaveCount(1);
    expect(await collisions(page, source, target)).toEqual([]);
  }
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' && response.url().endsWith(`/nodes/${obstacle}`),
  );
  await page.mouse.up();
  expect((await saved).status()).toBe(200);
  await expect(edge).not.toHaveAttribute('d', before!);
  expect(await collisions(page, source, target)).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('routing-desktop.png') });
  await page.reload();
  await expect(edge).toHaveCount(1);
  expect(await collisions(page, source, target)).toEqual([]);

  await authenticateAs(page.context(), course.users.studentWithoutProgress.id);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(offering.pagePath());
  await expect(edge).toHaveCount(1);
  expect(await collisions(page, source, target)).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('routing-mobile.png') });
});

test('a failed WASM load retries once, then offers retry without drawing an unsafe native dependency', async ({
  page,
  course,
  teacherApi: api,
}) => {
  const roadmap = await (await api.get(course.apiPath())).json();
  await authenticateAs(page.context(), course.users.teacher.id);
  let blockedRequests = 0;
  await page.route('**/vendor/libavoid/0.4.5/libavoid.wasm', (route) => {
    blockedRequests += 1;
    return route.abort();
  });
  await page.goto(course.pagePath());
  await expect(
    page.getByRole('alert').filter({ hasText: 'No pudimos trazar las dependencias.' }),
  ).toBeVisible();
  expect(blockedRequests).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.react-flow__edge-path')).toHaveCount(0);
  await page.unroute('**/vendor/libavoid/0.4.5/libavoid.wasm');
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.locator('.react-flow__edge-path')).toHaveCount(roadmap.dependencies.length);
});
