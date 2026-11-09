import type { APIRequestContext, Page } from '@playwright/test';
import { expect, test, type E2ECourseOffering } from './fixtures';
import { authenticateAs, ok } from './helpers';
import { prepareNodeCreator } from './create-node';

const hint = 'Revisa el material aunque sea po...';

async function nodeWithResources(teacher: APIRequestContext, course: E2ECourseOffering) {
  const { createNode } = await prepareNodeCreator(teacher, course, {
    description: 'Material obligatorio.',
    positionY: 150,
  });
  const node = await createNode(`Material ${crypto.randomUUID().slice(0, 8)}`, 350);
  await ok(
    await teacher.post(course.apiPath(`/nodes/${node.id}/resources`), {
      data: { title: 'Clase grabada', url: 'https://example.test/clase', type: 'LINK' },
    }),
    201,
  );
  await ok(
    await teacher.post(course.apiPath(`/nodes/${node.id}/resources`), {
      multipart: {
        file: { name: 'guia.txt', mimeType: 'text/plain', buffer: Buffer.from('Contenido') },
      },
    }),
    201,
  );
  return node;
}

async function resourcesOf(api: APIRequestContext, path: string, nodeId: string) {
  const roadmap = await (await ok(await api.get(path))).json();
  return roadmap.nodes.find((node: { id: string }) => node.id === nodeId).resources as {
    title: string;
    accessCount: number;
    isReviewed?: boolean;
  }[];
}

function hintPopup(page: Page) {
  return page.locator('[data-slot="tooltip-content"]').filter({ hasText: hint });
}

async function expectGatedCompletion(page: Page) {
  const complete = page.getByRole('button', { name: 'Completar', exact: true });
  await expect(complete).toHaveAttribute('aria-disabled', 'true');
  await complete.click({ force: true });
  await expect(hintPopup(page)).toBeVisible();
  return complete;
}

test('a student reviews every Resource before completing, and each access counts', async ({
  page,
  course,
  apiAs,
}) => {
  const teacher = await apiAs(course.users.teacher);
  const node = await nodeWithResources(teacher, course);
  await authenticateAs(page.context(), course.users.studentWithoutProgress.id);
  await page.goto(`${course.pagePath()}?targetNode=${node.id}`);
  const detail = page.locator('#student-node-detail-panel');

  const complete = await expectGatedCompletion(page);
  const link = detail.getByRole('link', { name: 'Abrir enlace Clase grabada' });
  await expect(link).toContainText('0 accesos');
  const popup = page.waitForEvent('popup');
  await link.click();
  await (await popup).close();
  await expect(link).toContainText('1 acceso');
  await expect(link).toContainText('Ya lo revisaste');
  await expect(complete).toHaveAttribute('aria-disabled', 'true');

  const file = detail.getByRole('link', { name: 'Descargar guia.txt' });
  await expect(file).toContainText('9 B');
  const download = page.waitForEvent('download');
  await file.click();
  await (await download).cancel();
  await expect(file).toContainText('Ya lo revisaste');
  await expect(complete).not.toHaveAttribute('aria-disabled');
  await complete.click();
  await expect(page.getByRole('button', { name: 'Completado' })).toBeVisible();
  await expect(page.locator('[data-slot="tooltip-content"]')).toHaveCount(0);

  await expect
    .poll(async () =>
      (await resourcesOf(teacher, course.apiPath(), node.id)).map(({ accessCount }) => accessCount),
    )
    .toEqual([1, 1]);
});

test('the Canvas preview gates completion with simulated reviews that never count', async ({
  page,
  course,
  apiAs,
}) => {
  const teacher = await apiAs(course.users.teacher);
  await ok(await teacher.delete(course.apiPath('/simulation')));
  const node = await nodeWithResources(teacher, course);
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(course.pagePath());
  await page.getByRole('button', { name: 'Vista estudiante' }).click();
  await page.locator(`.react-flow__node[data-id="${node.id}"]`).click();
  const detail = page.locator('#student-node-detail-panel');

  const complete = await expectGatedCompletion(page);
  const popup = page.waitForEvent('popup');
  await detail.getByRole('link', { name: 'Abrir enlace Clase grabada' }).click();
  await (await popup).close();
  const download = page.waitForEvent('download');
  await detail.getByRole('link', { name: 'Descargar guia.txt' }).click();
  await (await download).cancel();
  await expect(complete).not.toHaveAttribute('aria-disabled');
  await complete.click();
  await expect(page.getByRole('button', { name: 'Completado' })).toBeVisible();

  expect(
    (await resourcesOf(teacher, course.apiPath(), node.id)).map(({ accessCount }) => accessCount),
  ).toEqual([0, 0]);
  expect(
    (await resourcesOf(teacher, course.apiPath('/simulation'), node.id)).map(
      ({ isReviewed }) => isReviewed,
    ),
  ).toEqual([true, true]);
});
