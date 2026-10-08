import { enterRoadmap } from './enter-roadmap';
import { expect, test } from './fixtures';
import { sessionCookie, authenticateAs } from './helpers';

type Notice = {
  id: string;
  subject: string;
  body: string;
  read: boolean;
  data: Record<string, unknown>;
};

test('used Type renames deliver one general notice across Sections and recognize together with Nodes', async ({
  request,
  course,
  createUser,
  page,
}) => {
  const roadmapPath = course.apiPath;
  const author = { cookie: await sessionCookie(course.users.teacher.id) };
  const student = course.users.studentWithoutProgress.id;
  await enterRoadmap(page, course.pagePath(), student);
  await page.goto('/academic-overview');
  const otherSection = course.users.studentComplete.id;
  const roadmap = await (await request.get(roadmapPath(), { headers: author })).json();
  const suffix = crypto.randomUUID();
  const outsider = (await createUser()).id;
  const before = `Lecturas ${suffix}`;
  const after = `Guías ${suffix}`;
  const nodeIds: string[] = [];
  const notices = async (userId: string = student) => {
    const response = await request.get(
      `/api/notifications?roadmapId=${roadmap.roadmap.id}&limit=100`,
      {
        headers: { cookie: await sessionCookie(userId) },
      },
    );
    expect(response.status()).toBe(200);
    return (await response.json()).notifications as Notice[];
  };
  const classification = async (userId: string = student) =>
    (await notices(userId)).filter((n) => n.data.nextTypeName === after);
  const patch = async (data: Record<string, unknown>) => {
    const response = await request.patch(roadmapPath(`/node-types/${typeId}`), {
      headers: author,
      data,
    });
    expect(response.status()).toBe(200);
    return response;
  };
  const anonymous = await request.patch(roadmapPath(`/node-types/${roadmap.nodeTypes[0].id}`), {
    data: { name: before },
  });
  expect(anonymous.status()).toBe(401);
  const created = await request.post(roadmapPath('/node-types'), {
    headers: author,
    data: { name: before, icon: 'BookOpen', color: '#024AD8' },
  });
  expect(created.status()).toBe(201);
  const typeId = (await created.json()).nodeType.id;
  await patch({ name: after });
  expect(await classification()).toHaveLength(0);
  await patch({ name: before });
  for (const isVisible of [true, true, false]) {
    const response = await request.post(roadmapPath('/nodes'), {
      headers: author,
      data: {
        title: `Nodo ${suffix} ${nodeIds.length}`,
        nodeTypeId: typeId,
        positionX: 2000 + nodeIds.length * 320,
        positionY: 0,
        isVisible,
      },
    });
    expect(response.status()).toBe(201);
    nodeIds.push((await response.json()).node.id);
  }
  await patch({ icon: 'GraduationCap' });
  await patch({ color: '#1467A8' });
  expect(await classification()).toHaveLength(0);
  const forbidden = await request.patch(roadmapPath(`/node-types/${typeId}`), {
    headers: { cookie: await sessionCookie(student) },
    data: { name: after },
  });
  expect(forbidden.status()).toBe(403);
  await patch({ name: after });
  await expect.poll(() => classification()).toHaveLength(1);
  for (const userId of [
    otherSection,
    course.users.teachingAssistant.id,
    course.users.multiCourseStudent.id,
  ])
    await expect.poll(() => classification(userId)).toHaveLength(1);
  for (const userId of [course.users.teacher.id, course.users.withdrawnStudent.id, outsider])
    expect(await classification(userId)).toHaveLength(0);
  const notice = (await classification())[0];
  expect(notice).toMatchObject({
    subject: `Tipo «${before}» → «${after}»`,
    body: `El tipo «${before}» ahora se llama «${after}».`,
    read: false,
    data: {
      targetKind: 'roadmap',
      changeKind: 'classification-updated',
      previousTypeName: before,
      nextTypeName: after,
    },
  });
  expect(notice.data.nodeId).toBeUndefined();
  const count = await request.get(`/api/notifications/counts?roadmapId=${roadmap.roadmap.id}`, {
    headers: { cookie: await sessionCookie(student) },
  });
  expect((await count.json()).count).toBeGreaterThan(0);
  await authenticateAs(page.context(), student);
  await page.goto('/academic-overview');
  await expect(page.getByRole('button', { name: /^Avisos, .* sin leer$/ })).toBeVisible();
  await expect(
    page.getByLabel(new RegExp(`avisos sin leer para el curso ${course.courseName}`)),
  ).toBeVisible();
  await page.getByRole('button', { name: /^Avisos(,|$)/ }).click();
  await page
    .getByRole('list', { name: 'Lista de avisos' })
    .getByRole('button')
    .filter({ hasText: course.courseName })
    .filter({ hasText: /El Roadmap ha recibido \d+ cambios\./ })
    .click();
  await expect(page).toHaveURL(course.pagePath());
  await expect(page).not.toHaveURL(/targetNode=/);
  await expect(
    page.getByRole('dialog', { name: `Cambios en el Roadmap de ${course.courseCode}` }),
  ).toBeVisible();
  await expect.poll(() => classification()).toHaveLength(0);
  const pendingNodes = (await notices()).filter(
    (n) => nodeIds.includes(String(n.data.nodeId)) && n.data.targetKind === 'node',
  );
  expect(pendingNodes).toHaveLength(0);
  await page.getByRole('button', { name: 'Entendido' }).click();
  const reassigned = await request.patch(roadmapPath(`/nodes/${nodeIds[0]}`), {
    headers: author,
    data: { nodeTypeId: roadmap.nodeTypes[0].id },
  });
  expect(reassigned.status()).toBe(200);
  await expect.poll(() => classification()).toHaveLength(0);
  // Reassigning the Node type is stored immediately (no grouping window, see ADR-0014).
  await expect
    .poll(async () =>
      (await notices()).some(
        (n) => n.data.nodeId === nodeIds[0] && n.data.changeKind === 'node-updated',
      ),
    )
    .toBe(true);
  expect(
    (await notices()).some(
      (n) => n.data.nodeId === nodeIds[0] && n.data.changeKind === 'node-available',
    ),
  ).toBe(false);
  for (const id of nodeIds.slice(0, 2)) {
    expect(
      (
        await request.patch(roadmapPath(`/nodes/${id}`), {
          headers: author,
          data: { isVisible: false },
        })
      ).status(),
    ).toBe(200);
  }
  await patch({ name: `Oculto ${suffix}` });
  expect((await notices()).filter((n) => n.data.nextTypeName === `Oculto ${suffix}`)).toHaveLength(
    0,
  );
});

test('a PostgreSQL classification-notice failure preserves the confirmed Type rename', async ({
  request,
  course,
  rejectNoticeInserts,
}) => {
  const roadmapPath = course.apiPath;
  const author = { cookie: await sessionCookie(course.users.teacher.id) };
  const suffix = crypto.randomUUID().replaceAll('-', '');
  const nextName = `Renombre ${suffix}`;
  const created = await request.post(roadmapPath('/node-types'), {
    headers: author,
    data: { name: `Antes ${suffix}`, icon: 'BookOpen', color: '#024AD8' },
  });
  expect(created.status()).toBe(201);
  const typeId = (await created.json()).nodeType.id;
  const node = await request.post(roadmapPath('/nodes'), {
    headers: author,
    data: { title: `Nodo ${suffix}`, nodeTypeId: typeId, positionX: 4000, positionY: 0 },
  });
  expect(node.status()).toBe(201);
  const failure = await rejectNoticeInserts({
    roadmapId: course.roadmapId,
    noticeClass: 'roadmap-classification-changed',
  });
  const renamed = await request.patch(roadmapPath(`/node-types/${typeId}`), {
    headers: author,
    data: { name: nextName },
  });
  expect(renamed.status()).toBe(200);
  expect((await renamed.json()).nodeType.name).toBe(nextName);
  const persisted = await request.get(roadmapPath(), { headers: author });
  expect((await persisted.json()).nodeTypes).toContainEqual(
    expect.objectContaining({ id: typeId, name: nextName }),
  );
  await expect.poll(() => failure.wasAttempted()).toBe(true);
  const inbox = await request.get('/api/notifications?limit=100', {
    headers: { cookie: await sessionCookie(course.users.studentWithoutProgress.id) },
  });
  expect(
    (await inbox.json()).notifications.some((n: Notice) => n.data.nextTypeName === nextName),
  ).toBe(false);
});
