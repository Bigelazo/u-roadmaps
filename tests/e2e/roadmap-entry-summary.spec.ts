import { expect, test } from './fixtures';
import { authenticateAs } from './helpers';

test('entry recognizes Node notices and shows changes once without targeting a Node', async ({
  page,
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  await authenticateAs(page.context(), course.users.studentWithoutProgress.id);
  await page.goto(course.pagePath());
  await expect(page.locator('.react-flow')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/academic-overview');
  expect(
    (
      await author.patch(course.apiPath(`/nodes/${course.nodes.first}`), {
        data: { title: 'Pilas y colas' },
      })
    ).status(),
  ).toBe(200);
  const pending = async () =>
    (await (await recipient.get(`/api/notifications?roadmapId=${course.roadmapId}`)).json())
      .notifications;
  await expect.poll(pending).toHaveLength(1);
  const notice = (await pending())[0];
  await page.getByRole('button', { name: 'Avisos, 1 sin leer', exact: true }).click();
  await page.getByRole('button', { name: /Pilas y colas/ }).click();
  await expect(page).toHaveURL(course.pagePath());
  const dialog = page.getByRole('dialog', {
    name: `Cambios en el Roadmap de ${course.courseCode}`,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Desde tu última visita')).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Pilas y colas', exact: true })).toBeVisible();
  await expect.poll(pending).toHaveLength(0);
  await expect(dialog.getByRole('button')).toHaveCount(1);
  await page.getByRole('button', { name: 'Entendido' }).click();
  await expect(page.getByRole('button', { name: 'Avisos', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.react-flow')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(`${course.pagePath()}?notice=${notice.id}&targetNode=${course.nodes.first}`);
  await expect(page.locator('.react-flow')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cerrar información del Nodo' })).toHaveCount(0);
});

test('first entry clears pending notices silently and opening a Node or Inbox recognizes no later changes', async ({
  page,
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const pending = async () =>
    (await (await recipient.get(`/api/notifications?roadmapId=${course.roadmapId}`)).json())
      .notifications;
  expect(
    (
      await author.patch(course.apiPath(`/nodes/${course.nodes.first}`), {
        data: { description: 'Primer cambio' },
      })
    ).status(),
  ).toBe(200);
  await expect.poll(pending).toHaveLength(1);
  await authenticateAs(page.context(), course.users.studentWithoutProgress.id);
  await page.goto(course.pagePath());
  await expect.poll(pending).toHaveLength(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(
    (
      await author.patch(course.apiPath(`/nodes/${course.nodes.first}`), {
        data: { description: 'Cambio mientras estudia' },
      })
    ).status(),
  ).toBe(200);
  await expect.poll(pending).toHaveLength(1);
  const before = await pending();
  const mutations: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/notifications') && request.method() !== 'GET')
      mutations.push(request.url());
  });
  await page.getByRole('button', { name: 'Avisos, 1 sin leer', exact: true }).click();
  await expect(page.getByRole('button', { name: /Nodo actualizado/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator(`.react-flow__node[data-id="${course.nodes.first}"]`).click();
  await expect(page.getByRole('button', { name: 'Cerrar detalle' })).toBeVisible();
  expect(await pending()).toEqual(before);
  expect(before[0]).not.toHaveProperty('seen');
  expect(mutations).toEqual([]);
  expect(
    (
      await recipient.post('/api/notifications/openings', {
        data: {
          roadmapId: course.roadmapId,
          nodeId: course.nodes.first,
          operationId: crypto.randomUUID(),
        },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await recipient.patch(`/api/notifications/${before[0].id}`, { data: { action: 'seen' } })
    ).status(),
  ).toBe(405);
});

test('entry from Academic overview groups changes under current Node titles and puts classification last', async ({
  page,
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithProgress);
  await authenticateAs(page.context(), course.users.studentWithProgress.id);
  const entered = page.waitForResponse((response) =>
    response.url().endsWith('/api/notifications/acknowledge'),
  );
  await page.goto(course.pagePath());
  expect((await entered).status()).toBe(200);
  await page.goto('/academic-overview');
  const type = await author.post(course.apiPath('/node-types'), {
    data: { name: 'Lectura inicial', icon: 'BookOpen', color: '#024AD8' },
  });
  expect(type.status()).toBe(201);
  const typeId = (await type.json()).nodeType.id;
  expect(
    (
      await author.patch(course.apiPath(`/nodes/${course.nodes.first}`), {
        data: { nodeTypeId: typeId },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await author.patch(course.apiPath(`/node-types/${typeId}`), {
        data: { name: 'Lectura final' },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await author.patch(course.apiPath(`/nodes/${course.nodes.first}`), {
        data: { description: 'Nueva descripción' },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await author.patch(course.apiPath(`/nodes/${course.nodes.first}`), {
        data: { title: 'Título vigente' },
      })
    ).status(),
  ).toBe(200);
  const pending = async () =>
    (
      await (
        await recipient.get(`/api/notifications?roadmapId=${course.roadmapId}&limit=100`)
      ).json()
    ).notifications;
  await expect.poll(pending).toHaveLength(4);
  await page.getByRole('link', { name: `Abrir roadmap de ${course.courseName}` }).click();
  const dialog = page.getByRole('dialog', {
    name: `Cambios en el Roadmap de ${course.courseCode}`,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { level: 3 })).toHaveText([
    'Título vigente',
    'Ruta y clasificación',
  ]);
  await expect(dialog.getByText('Se actualizó la descripción.', { exact: true })).toBeVisible();
  await expect(
    dialog.getByText('El tipo «Lectura inicial» ahora se llama «Lectura final».', { exact: true }),
  ).toBeVisible();
  await expect(dialog.locator('time, a')).toHaveCount(0);
  await expect(dialog.getByText(course.users.teacher.name)).toHaveCount(0);
  await expect.poll(pending).toHaveLength(0);
});
