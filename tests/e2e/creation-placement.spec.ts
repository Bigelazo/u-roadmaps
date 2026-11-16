import { expect, test } from './fixtures';
import { authenticateAs, ok } from './helpers';

test('a crowded canvas creates one identified Node and saves its complete displacement in one request', async ({
  page,
  course,
  createCourse,
  teacherApi: api,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 700 });
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
      data: { title: 'Ocupado en el centro', nodeTypeId, positionX: 0, positionY: 0 },
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
  await page.getByRole('button', { name: 'Crear en el mapa' }).click();
  await page.getByRole('menuitem', { name: 'Crear nodo' }).click();
  const dialog = page.getByRole('dialog', { name: 'Crear nodo' });
  await dialog.getByLabel('Título').fill('Nuevo contenido de programación');
  const submitted = page.waitForResponse(
    (response) =>
      response.url().endsWith(offering.apiPath('/nodes')) && response.request().method() === 'POST',
  );
  let positionRequests = 0;
  page.on('request', (request) => {
    if (request.method() === 'PATCH' && request.url().includes(offering.apiPath()))
      positionRequests += 1;
  });
  await dialog.getByRole('button', { name: 'Crear nodo' }).click();
  const response = await submitted;
  expect(response.status()).toBe(201);
  const intent = response.request().postDataJSON();
  const createdId = (await response.json()).node.id;
  expect(createdId).toBe(intent.nodeId);
  expect(intent.displaced).toHaveLength(1);
  expect(intent.displaced[0].nodeId).toBe(occupiedId);
  await expect(dialog).toHaveCount(0);
  const saved = await (await api.get(offering.apiPath())).json();
  expect(saved.nodes).toContainEqual(
    expect.objectContaining({
      id: createdId,
      positionX: intent.positionX,
      positionY: intent.positionY,
    }),
  );
  for (const displaced of intent.displaced)
    expect(saved.nodes).toContainEqual(
      expect.objectContaining({
        id: displaced.nodeId,
        positionX: displaced.position.x,
        positionY: displaced.position.y,
      }),
    );
  expect(positionRequests).toBe(0);
  await page.screenshot({
    path: testInfo.outputPath('atomic-creation.png'),
    animations: 'disabled',
  });
});
