import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { authenticateAs, ok } from './helpers';

async function openCreator(page: Page, title: string) {
  await page.getByRole('button', { name: 'Crear en el mapa' }).click();
  await page.getByRole('menuitem', { name: 'Crear nodo' }).click();
  const dialog = page.getByRole('dialog', { name: 'Crear nodo' });
  await dialog.getByLabel('Título').fill(title);
  await dialog.getByRole('button', { name: 'Recurso', exact: true }).click();
  await dialog.getByRole('tab', { name: 'Enlace' }).click();
  const composer = dialog.getByRole('form', { name: 'Editor de recurso' });
  await composer.getByRole('textbox', { name: 'Título' }).fill('Guía pendiente');
  await composer.getByRole('textbox', { name: 'Enlace' }).fill('https://example.test/guide');
  await composer.getByRole('button', { name: 'Agregar enlace' }).click();
  return dialog;
}

test('a committed creation with a lost response recovers current saved state before attaching Resources once', async ({
  page,
  course,
  teacherApi: api,
}) => {
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(course.pagePath());
  let createdId = '';
  let submissions = 0;
  let confirmedRead = false;
  let attachments = 0;
  await page.route(`**${course.apiPath()}`, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    confirmedRead ||= Boolean(
      createdId && body.nodes.some((node: { id: string }) => node.id === createdId),
    );
    await route.fulfill({ response });
  });
  await page.route(`**${course.apiPath('/nodes')}`, async (route) => {
    submissions += 1;
    const intent = route.request().postDataJSON();
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    createdId = intent.nodeId;
    await ok(
      await api.patch(course.apiPath(`/nodes/${createdId}`), {
        data: {
          title: 'Editado durante recuperación',
          description: null,
          nodeTypeId: intent.nodeTypeId,
        },
      }),
    );
    await ok(
      await api.patch(course.apiPath('/placement'), {
        data: { positions: [{ nodeId: course.nodes.first, position: { x: 700, y: 540 } }] },
      }),
      204,
    );
    await route.abort('failed');
  });
  await page.route('**/resources', async (route) => {
    expect(confirmedRead).toBe(true);
    attachments += 1;
    await route.continue();
  });
  const dialog = await openCreator(page, 'Mi nodo recuperable');
  await dialog.getByRole('button', { name: 'Crear nodo' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByLabel('Notificaciones').getByText('Nodo creado con 1 recurso.'),
  ).toBeVisible();
  const saved = await (await api.get(course.apiPath())).json();
  expect(saved.nodes.filter((node: { id: string }) => node.id === createdId)).toEqual([
    expect.objectContaining({
      title: 'Editado durante recuperación',
      resources: [expect.objectContaining({ title: 'Guía pendiente' })],
    }),
  ]);
  expect(saved.nodes).toContainEqual(
    expect.objectContaining({ id: course.nodes.first, positionX: 700, positionY: 540 }),
  );
  expect(submissions).toBe(1);
  expect(attachments).toBe(1);
});

test('unavailable creation recovery preserves the draft and explicitly resends its original identity without repeating displacement or Resources', async ({
  page,
  course,
  createCourse,
  teacherApi: api,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const offering = await createCourse({
    roadmap: false,
    participants: [{ user: course.users.teacher, role: 'TEACHER' }],
  });
  await ok(await api.post(offering.apiPath(), { data: {} }), 201);
  const initial = await (await api.get(offering.apiPath())).json();
  const nodeTypeId = initial.nodeTypes.find(
    (type: { isPredefined: boolean }) => type.isPredefined,
  ).id;
  const occupied = await ok(
    await api.post(offering.apiPath('/nodes'), {
      data: { title: 'Ocupado', nodeTypeId, positionX: 0, positionY: 0 },
    }),
    201,
  );
  const occupiedId = (await occupied.json()).node.id;
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(offering.pagePath());
  await expect(page.locator(`.react-flow__node[data-id="${occupiedId}"]`)).toBeVisible();
  const canvas = (await page.locator('.react-flow').boundingBox())!;
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await page.mouse.wheel(0, -2400);
  await expect(page.locator('.react-flow__viewport')).toHaveCSS(
    'transform',
    /^matrix\(2, 0, 0, 2,/,
  );
  let unavailable = false;
  const attempts: Array<{ nodeId: string; displaced: unknown[] }> = [];
  let attachments = 0;
  await page.route(`**${offering.apiPath()}`, async (route) => {
    if (unavailable) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Sin conexión' } }),
      });
      return;
    }
    await route.continue();
  });
  await page.route(`**${offering.apiPath('/nodes')}`, async (route) => {
    attempts.push(route.request().postDataJSON());
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    if (attempts.length === 1) {
      unavailable = true;
      await route.abort('failed');
      return;
    }
    unavailable = false;
    await route.fulfill({ response });
  });
  await page.route('**/resources', async (route) => {
    attachments += 1;
    await route.continue();
  });
  const dialog = await openCreator(page, 'Borrador con identidad');
  await dialog.getByRole('button', { name: 'Crear nodo' }).click();
  await expect(dialog.getByRole('button', { name: 'Reenviar creación' })).toBeVisible();
  await expect(dialog.getByRole('alert')).toContainText('No se pudo confirmar si el nodo se creó.');
  await expect(dialog.getByLabel('Título')).toBeDisabled();
  await expect(dialog.getByLabel('Título')).toHaveValue('Borrador con identidad');
  await expect(dialog.getByRole('heading', { name: 'Recursos (1)' })).toBeVisible();
  expect(attempts).toHaveLength(1);
  expect(attempts[0].displaced).toHaveLength(1);
  expect(attachments).toBe(0);
  await dialog.screenshot({
    path: testInfo.outputPath('uncertain-creation-draft.png'),
    animations: 'disabled',
  });
  await ok(
    await api.patch(offering.apiPath('/placement'), {
      data: { positions: [{ nodeId: occupiedId, position: { x: 1000, y: 600 } }] },
    }),
    204,
  );
  await dialog.getByRole('button', { name: 'Reenviar creación' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByLabel('Notificaciones').getByText('Nodo creado con 1 recurso.'),
  ).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toEqual(attempts[0]);
  expect(attachments).toBe(1);
  const saved = await (await api.get(offering.apiPath())).json();
  expect(saved.nodes.filter((node: { id: string }) => node.id === attempts[0].nodeId)).toEqual([
    expect.objectContaining({ resources: [expect.objectContaining({ title: 'Guía pendiente' })] }),
  ]);
  expect(saved.nodes).toContainEqual(
    expect.objectContaining({ id: occupiedId, positionX: 1000, positionY: 600 }),
  );
});

test('a failed authoritative movement reload keeps persistent feedback until recovery succeeds', async ({
  page,
  course,
  teacherApi: api,
}, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await authenticateAs(page.context(), course.users.teacher.id);
  const initialLoad = page.waitForResponse(
    (response) => response.url().endsWith(course.apiPath()) && response.status() === 200,
  );
  await page.goto(course.pagePath());
  await initialLoad;
  const node = page.locator(`.react-flow__node[data-id="${course.nodes.first}"]`);
  await expect(node).toBeVisible();
  await page.clock.install();
  await page.getByRole('button', { name: 'Centrar mapa' }).click();
  await page.clock.runFor(1000);
  await expect(node).toBeInViewport();
  let unavailable = false;
  let reject = true;
  await page.route(`**${course.apiPath()}`, async (route) => {
    if (unavailable) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Sin conexión' } }),
      });
      return;
    }
    await route.continue();
  });
  await page.route(`**${course.apiPath('/placement')}`, async (route) => {
    if (reject) {
      reject = false;
      unavailable = true;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'No se pudo guardar la posición.' } }),
      });
      return;
    }
    await route.continue();
  });
  await node.click();
  await node.focus();
  await page.keyboard.press('Shift+ArrowRight');
  const feedback = page.getByRole('alert').filter({ hasText: 'No se pudo sincronizar el canvas' });
  await expect(feedback).toBeVisible();
  await page.clock.fastForward(15000);
  await expect(feedback).toBeVisible();
  await feedback.screenshot({
    path: testInfo.outputPath('persistent-unsynchronized-placement.png'),
    animations: 'disabled',
  });
  await page.screenshot({
    path: testInfo.outputPath('persistent-placement-context.png'),
    animations: 'disabled',
  });
  unavailable = false;
  await feedback.getByRole('button', { name: 'Comprobar guardado' }).click();
  await expect(feedback).toHaveCount(0);
  const initial = await (await api.get(course.apiPath())).json();
  await node.focus();
  const persisted = page.waitForResponse(
    (response) =>
      response.url().endsWith(course.apiPath('/placement')) && response.status() === 204,
  );
  await page.keyboard.press('Shift+ArrowRight');
  await persisted;
  const saved = await (await api.get(course.apiPath())).json();
  expect(
    saved.nodes.find((item: { id: string }) => item.id === course.nodes.first).positionX,
  ).not.toBe(
    initial.nodes.find((item: { id: string }) => item.id === course.nodes.first).positionX,
  );
});
