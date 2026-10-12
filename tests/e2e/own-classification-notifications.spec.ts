import { enterRoadmap } from './enter-roadmap';
import { expect, test, type E2EUser } from './fixtures';
import { authenticateAs, ok } from './helpers';
import { listNotices, type StoredNotice } from './notices';

test('used Type renames deliver one general notice across Sections and recognize together with Nodes', async ({
  request,
  course,
  apiAs,
  teacherApi: author,
  studentApi,
  createUser,
  page,
}) => {
  const roadmapPath = course.apiPath;
  const student = course.users.studentWithoutProgress;
  await enterRoadmap(page, course.pagePath(), student.id);
  await page.goto('/academic-overview');
  const otherSection = course.users.studentComplete;
  const roadmap = await (await author.get(roadmapPath())).json();
  const suffix = crypto.randomUUID();
  const outsider = await createUser();
  const before = `Lecturas ${suffix}`;
  const after = `Guías ${suffix}`;
  const nodeIds: string[] = [];
  const notices = async (user: E2EUser = student) =>
    listNotices(await apiAs(user), { roadmapId: course.roadmapId, limit: 100 });
  const classification = async (user: E2EUser = student) =>
    (await notices(user)).filter((n) => n.data.nextTypeName === after);
  const patch = async (data: Record<string, unknown>) =>
    ok(await author.patch(roadmapPath(`/node-types/${typeId}`), { data }));
  // Unauthenticated: the shared `request` carries no session cookie.
  await ok(
    await request.patch(roadmapPath(`/node-types/${roadmap.nodeTypes[0].id}`), {
      data: { name: before },
    }),
    401,
  );
  const created = await ok(
    await author.post(roadmapPath('/node-types'), {
      data: { name: before, icon: 'BookOpen', color: '#024AD8' },
    }),
    201,
  );
  const typeId = (await created.json()).nodeType.id;
  await patch({ name: after });
  expect(await classification()).toHaveLength(0);
  await patch({ name: before });
  for (const isVisible of [true, true, false]) {
    const response = await ok(
      await author.post(roadmapPath('/nodes'), {
        data: {
          title: `Nodo ${suffix} ${nodeIds.length}`,
          nodeTypeId: typeId,
          positionX: 2000 + nodeIds.length * 320,
          positionY: 0,
          isVisible,
        },
      }),
      201,
    );
    nodeIds.push((await response.json()).node.id);
  }
  await patch({ icon: 'GraduationCap' });
  await patch({ color: '#1467A8' });
  expect(await classification()).toHaveLength(0);
  await ok(
    await studentApi.patch(roadmapPath(`/node-types/${typeId}`), { data: { name: after } }),
    403,
  );
  await patch({ name: after });
  await expect.poll(() => classification()).toHaveLength(1);
  for (const user of [
    otherSection,
    course.users.teachingAssistant,
    course.users.multiCourseStudent,
  ])
    await expect.poll(() => classification(user)).toHaveLength(1);
  for (const user of [course.users.teacher, course.users.withdrawnStudent, outsider])
    expect(await classification(user)).toHaveLength(0);
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
  const count = await studentApi.get(`/api/notifications/counts?roadmapId=${course.roadmapId}`);
  expect((await count.json()).count).toBeGreaterThan(0);
  await authenticateAs(page.context(), student.id);
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
  await ok(
    await author.patch(roadmapPath(`/nodes/${nodeIds[0]}`), {
      data: { nodeTypeId: roadmap.nodeTypes[0].id },
    }),
  );
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
    await ok(await author.patch(roadmapPath(`/nodes/${id}`), { data: { isVisible: false } }));
  }
  await patch({ name: `Oculto ${suffix}` });
  expect((await notices()).filter((n) => n.data.nextTypeName === `Oculto ${suffix}`)).toHaveLength(
    0,
  );
});

test('a PostgreSQL classification-notice failure preserves the confirmed Type rename', async ({
  course,
  teacherApi: author,
  studentApi,
  rejectNoticeInserts,
}) => {
  const roadmapPath = course.apiPath;
  const suffix = crypto.randomUUID().replaceAll('-', '');
  const nextName = `Renombre ${suffix}`;
  const created = await ok(
    await author.post(roadmapPath('/node-types'), {
      data: { name: `Antes ${suffix}`, icon: 'BookOpen', color: '#024AD8' },
    }),
    201,
  );
  const typeId = (await created.json()).nodeType.id;
  await ok(
    await author.post(roadmapPath('/nodes'), {
      data: { title: `Nodo ${suffix}`, nodeTypeId: typeId, positionX: 4000, positionY: 0 },
    }),
    201,
  );
  const failure = await rejectNoticeInserts({
    roadmapId: course.roadmapId,
    noticeClass: 'roadmap-classification-changed',
  });
  const renamed = await ok(
    await author.patch(roadmapPath(`/node-types/${typeId}`), { data: { name: nextName } }),
  );
  expect((await renamed.json()).nodeType.name).toBe(nextName);
  const persisted = await author.get(roadmapPath());
  expect((await persisted.json()).nodeTypes).toContainEqual(
    expect.objectContaining({ id: typeId, name: nextName }),
  );
  await expect.poll(() => failure.wasAttempted()).toBe(true);
  const inbox = await studentApi.get('/api/notifications?limit=100');
  expect(
    ((await inbox.json()).notifications as StoredNotice[]).some(
      (n) => n.data.nextTypeName === nextName,
    ),
  ).toBe(false);
});
