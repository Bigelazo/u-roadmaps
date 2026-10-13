import type { APIRequestContext } from '@playwright/test';
import { expect, test as base, type E2ECourseOffering } from './fixtures';
import { authenticateAs, toast } from './helpers';
import { prepareNodeCreator } from './create-node';

const test = base.extend<{
  touchRoadmap: {
    offering: E2ECourseOffering;
    first: { id: string; title: string };
    second: { id: string; title: string };
    teacher: APIRequestContext;
    freeze: () => Promise<void>;
  };
}>({
  touchRoadmap: async ({ course, createCourse, createTerm, apiAs, waitForClosure }, provide) => {
    const term = await createTerm();
    const offering = await createCourse({
      ...term,
      roadmap: false,
      participants: [
        { user: course.users.teacher, role: 'TEACHER' },
        { user: course.users.studentWithoutProgress, role: 'STUDENT' },
      ],
    });
    const teacher = await apiAs(course.users.teacher);
    const created = await teacher.post(offering.apiPath(), { data: {} });
    expect(created.status()).toBe(201);
    offering.roadmapId = (await created.json()).roadmap.id;
    const { createNode } = await prepareNodeCreator(teacher, offering);
    const first = await createNode('Touch prerequisite', 0);
    const second = await createNode('Touch dependent', 240);
    expect(
      (
        await teacher.post(offering.apiPath('/dependencies'), {
          data: { sourceNodeId: first.id, targetNodeId: second.id },
        })
      ).status(),
    ).toBe(201);
    await provide({
      offering,
      first,
      second,
      teacher,
      freeze: async () => {
        await term.setFreezeDate('2020-01-01');
        await waitForClosure(offering);
      },
    });
  },
});

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('touch Node actions are labeled, modal, contextual, and hand focus to confirmations', async ({
  page,
  course,
  touchRoadmap: { offering, first },
}) => {
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(offering.pagePath());
  const node = page.locator(`.react-flow__node[data-id="${first.id}"]`);
  const trigger = node.getByRole('button', { name: 'Abrir menú de acciones del nodo' });
  await trigger.tap();
  const sheet = page.getByRole('dialog', { name: 'Menú de acciones del nodo' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('button')).toHaveText([
    'Cerrar acciones',
    'Bloquear rama',
    'Ocultar para estudiantes',
    'Agregar recurso',
    'Eliminar nodo',
  ]);
  await expect(page.getByRole('group', { name: 'Menú de acciones del nodo' })).toHaveCount(0);
  await expect(page.locator('#roadmap-editor-panel')).toBeHidden();
  await expect(node.getByTestId('node-action-trigger-close')).toBeVisible();
  await expect
    .poll(async () => {
      const box = await sheet.boundingBox();
      return box ? box.y + box.height : 0;
    })
    .toBeCloseTo(844, 0);
  await sheet.getByRole('button', { name: 'Eliminar nodo' }).focus();
  await page.keyboard.press('Tab');
  await expect(sheet.getByRole('button', { name: 'Cerrar acciones' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(sheet.getByRole('button', { name: 'Eliminar nodo' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.tap();
  // A tap over the Node body hits the full-screen backdrop and cannot select it.
  const nodeBox = await node.boundingBox();
  await page.touchscreen.tap(nodeBox!.x + nodeBox!.width / 2, nodeBox!.y + nodeBox!.height / 2);
  await expect(sheet).toBeHidden();
  await expect(page.locator('#roadmap-editor-panel')).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.tap();
  await sheet.getByRole('button', { name: 'Bloquear rama' }).tap();
  const confirmation = page.getByRole('alertdialog');
  await expect(confirmation).toBeVisible();
  await expect(sheet).toBeHidden();
  await expect(confirmation).toContainText('Nodo seleccionado');
  await expect(confirmation).toContainText('Dependiente');
  await expect
    .poll(() => confirmation.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true);
  await confirmation.getByRole('button', { name: 'Bloquear rama' }).tap();
  await expect(confirmation).toBeHidden();
  await trigger.tap();
  await expect(sheet.getByRole('button', { name: 'Desbloquear', exact: true })).toBeVisible();
  await sheet.getByRole('button', { name: 'Cerrar acciones' }).tap();
  await expect(trigger).toBeFocused();
});

test('touch actions reuse visibility, Resource editing, draft guards, and deletion', async ({
  page,
  course,
  touchRoadmap: { offering, first, second },
}) => {
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(offering.pagePath());
  const node = page.locator(`.react-flow__node[data-id="${first.id}"]`);
  const trigger = node.getByRole('button', { name: 'Abrir menú de acciones del nodo' });
  const sheet = page.getByRole('dialog', { name: 'Menú de acciones del nodo' });
  const confirmation = page.getByRole('alertdialog');
  await trigger.tap();
  await sheet.getByRole('button', { name: 'Ocultar para estudiantes' }).tap();
  await expect(confirmation).toContainText('Touch prerequisite');
  await expect(confirmation).toContainText('Touch dependent');
  await confirmation.getByRole('button', { name: 'Ocultar', exact: true }).tap();
  await expect(confirmation).toBeHidden();
  await trigger.tap();
  await expect(sheet.getByRole('button')).toHaveText([
    'Cerrar acciones',
    'Mostrar para estudiantes',
    'Agregar recurso',
    'Eliminar nodo',
  ]);
  await sheet.getByRole('button', { name: 'Mostrar para estudiantes' }).tap();
  await expect(confirmation).toContainText(
    'Este Nodo se mostrará al estudiantado y quedará disponible inmediatamente. No tendrá Dependencias ni Bloqueo docente.',
  );
  await confirmation.getByRole('button', { name: 'Mostrar', exact: true }).tap();
  await expect(confirmation).toBeHidden();

  await trigger.tap();
  await sheet.getByRole('button', { name: 'Agregar recurso' }).tap();
  const composer = page.getByRole('form', { name: 'Editor de recurso' });
  await expect(composer).toBeVisible();
  await expect
    .poll(() => composer.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true);
  await composer.getByRole('tab', { name: 'Enlace', exact: true }).tap();
  await composer.getByLabel('Título', { exact: true }).fill('Touch Resource draft');
  // Collapse the existing mobile editor to keep the canvas controls reachable.
  await page.getByRole('group', { name: 'Editor de nodo', exact: true }).locator('summary').tap();

  // Opening a different Node's composer must preserve the existing draft until confirmed.
  const secondTrigger = page
    .locator(`.react-flow__node[data-id="${second.id}"]`)
    .getByRole('button', { name: 'Abrir menú de acciones del nodo' });
  await secondTrigger.tap();
  await sheet.getByRole('button', { name: 'Agregar recurso' }).tap();
  await expect(confirmation).toContainText('Descartar cambios sin guardar');
  await confirmation.getByRole('button', { name: 'Seguir editando' }).tap();
  await page.getByRole('group', { name: 'Editor de nodo', exact: true }).locator('summary').tap();
  await expect(composer.getByLabel('Título', { exact: true })).toHaveValue('Touch Resource draft');
  await composer
    .getByRole('textbox', { name: 'Enlace', exact: true })
    .fill('https://example.test/touch-resource');
  await composer.getByRole('button', { name: 'Agregar enlace' }).tap();
  await expect(composer).toBeHidden();
  await expect(node.getByRole('img', { name: '1 enlace', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  await trigger.tap();
  await sheet.getByRole('button', { name: 'Eliminar nodo' }).tap();
  await expect(confirmation).toContainText('Touch prerequisite');
  await confirmation.getByRole('button', { name: 'Eliminar', exact: true }).tap();
  await expect(node).toHaveCount(0);
});

test('touch deletion prevents duplicate mutations and recovers after a failed request', async ({
  page,
  course,
  touchRoadmap: { offering, first },
}) => {
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(offering.pagePath());
  let releaseFailure = () => {};
  const failure = new Promise<void>((resolve) => {
    releaseFailure = resolve;
  });
  let mutations = 0;
  const path = `**${offering.apiPath(`/nodes/${first.id}`)}`;
  await page.route(path, async (route) => {
    if (route.request().method() !== 'DELETE') return route.continue();
    mutations += 1;
    await failure;
    await route.fulfill({ status: 500, json: { error: 'No se pudo eliminar el nodo.' } });
  });
  const node = page.locator(`.react-flow__node[data-id="${first.id}"]`);
  await node.getByRole('button', { name: 'Abrir menú de acciones del nodo' }).tap();
  const sheet = page.getByRole('dialog', { name: 'Menú de acciones del nodo' });
  await sheet.getByRole('button', { name: 'Eliminar nodo' }).tap();
  const confirmation = page.getByRole('alertdialog');
  const remove = confirmation.getByRole('button', { name: 'Eliminar', exact: true });
  await remove.tap();
  await expect.poll(() => mutations).toBe(1);
  await expect(remove).toBeDisabled();
  await expect(confirmation.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  await expect(sheet).toBeHidden();
  releaseFailure();
  await expect(remove).toBeEnabled();
  expect(mutations).toBe(1);
  await confirmation.getByRole('button', { name: 'Cancelar' }).tap();
  const error = toast(page, 'No se pudo eliminar el nodo.');
  await expect(error).toBeVisible();
  await error.getByRole('button', { name: 'Cerrar notificación', includeHidden: true }).tap();
  await page.unroute(path);
  await node.getByRole('button', { name: 'Abrir menú de acciones del nodo' }).tap();
  await sheet.getByRole('button', { name: 'Eliminar nodo' }).tap();
  await remove.tap();
  await expect(node).toHaveCount(0);
});

test('touch actions stay unreachable to students, Canvas preview, and frozen Roadmaps', async ({
  page,
  course,
  apiAs,
  touchRoadmap: { offering, first, teacher, freeze },
}) => {
  const trigger = page.getByRole('button', { name: 'Abrir menú de acciones del nodo' });
  const sheet = page.getByRole('dialog', { name: 'Menú de acciones del nodo' });
  await authenticateAs(page.context(), course.users.studentWithoutProgress.id);
  await page.goto(offering.pagePath());
  await expect(page.getByText('Touch prerequisite', { exact: true })).toBeVisible();
  await expect(trigger).toHaveCount(0);
  await expect(sheet).toHaveCount(0);
  const student = await apiAs(course.users.studentWithoutProgress);
  expect((await student.post(offering.apiPath(`/nodes/${first.id}/teacher-block`))).status()).toBe(
    403,
  );

  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(offering.pagePath());
  await expect(trigger).toHaveCount(2);
  await page.getByRole('button', { name: 'Vista estudiante' }).tap();
  await expect(page.getByText('Previsualización del canvas', { exact: true })).toBeVisible();
  await expect(trigger).toHaveCount(0);
  await expect(sheet).toHaveCount(0);

  await freeze();
  await page.goto(offering.pagePath());
  await expect(page.getByText('Touch prerequisite', { exact: true })).toBeVisible();
  await expect(trigger).toHaveCount(0);
  await expect(sheet).toHaveCount(0);
  expect((await teacher.post(offering.apiPath(`/nodes/${first.id}/teacher-block`))).status()).toBe(
    409,
  );
});
