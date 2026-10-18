import type { APIRequestContext } from '@playwright/test';
import { createDependency, prepareNodeCreator } from './create-node';
import { enterRoadmap } from './enter-roadmap';
import { expect, test, type E2EUser } from './fixtures';
import { sql } from './database';
import { authenticateAs, ok } from './helpers';
import { listNotices, recognize, storeNotices } from './notices';
import { changeTeacherBlock, deleteNode } from './previewed-writes';

async function noticeCount(api: APIRequestContext, query: string) {
  return (await (await api.get(`/api/notifications/counts?${query}`)).json()).count;
}

test('visible Node changes reach the Inbox and Roadmap entry recognizes them', async ({
  course,
  teacherApi,
  studentApi,
  page,
}) => {
  const { createNode } = await prepareNodeCreator(teacherApi, course, { description: 'Detalle' });
  await enterRoadmap(page, course.pagePath(), course.users.studentWithoutProgress.id);
  await page.goto('/academic-overview');
  const title = `Aviso propio ${crypto.randomUUID()}`;
  const nodeId = (await createNode(title, 0)).id;
  const query = { roadmapId: course.roadmapId, nodeId };
  await expect.poll(async () => (await listNotices(studentApi, query)).length).toBe(1);
  const notices = await listNotices(studentApi, query);
  expect(notices).toHaveLength(1);
  expect(notices[0]).toMatchObject({
    subject: `Nuevo Nodo «${title}»`,
    read: false,
    data: { nodeId, actorName: course.users.teacher.name, noticeTarget: 'node-creation' },
  });
  await authenticateAs(page.context(), course.users.studentWithoutProgress.id);
  await page.goto('/academic-overview');
  await page.getByRole('button', { name: /^Avisos(,|$)/ }).click();
  await page.getByRole('button', { name: new RegExp(title) }).click();
  await expect(page).toHaveURL(course.pagePath());
  await expect(
    page.getByRole('dialog', { name: `Cambios en el Roadmap de ${course.courseCode}` }),
  ).toBeVisible();
  await expect
    .poll(() => noticeCount(studentApi, `roadmapId=${course.roadmapId}&nodeId=${nodeId}`))
    .toBe(0);
});

test('Resource notices persist context and share Roadmap entry recognition', async ({
  course,
  apiAs,
  teacherApi,
  studentApi,
  page,
}) => {
  const roadmapPath = course.apiPath;
  const author = teacherApi;
  const student = course.users.studentWithoutProgress;
  const teacher = course.users.teachingAssistant;
  const inactive = course.users.withdrawnStudent;
  const { createNode } = await prepareNodeCreator(author, course, {
    description: 'Detalle original',
  });
  await enterRoadmap(page, course.pagePath(), student.id);
  await page.goto('/academic-overview');
  const resourceTitle = `E2E material ${crypto.randomUUID()}.pdf`;
  const updatedTitle = `E2E material revisado ${crypto.randomUUID()}.pdf`;
  const secondResourceTitle = `E2E material de otra Unidad ${crypto.randomUUID()}`;
  const lateResourceTitle = `E2E material posterior ${crypto.randomUUID()}`;

  const getNotices = async (user: E2EUser, nodeId: string) =>
    listNotices(await apiAs(user), {
      roadmapId: course.roadmapId,
      nodeId,
      limit: 100,
    });
  const resourceNotices = async (user: E2EUser, nodeId: string) =>
    (await getNotices(user, nodeId)).filter(
      (notice) => typeof notice.data.resourceTitle === 'string',
    );
  const count = (nodeId: string) =>
    noticeCount(studentApi, `roadmapId=${course.roadmapId}&nodeId=${nodeId}`);

  const nodeId = (await createNode(`Recurso destino ${crypto.randomUUID()}`, 4000)).id;
  const otherNodeId = (await createNode(`Otra Unidad ${crypto.randomUUID()}`, 4400)).id;
  await expect.poll(() => count(nodeId)).toBe(1);
  await expect.poll(() => count(otherNodeId)).toBe(1);
  // Resource targets are independent after the new Nodes have been recognized.
  for (const user of [student, teacher]) await recognize(await apiAs(user), course.roadmapId);
  const initialNodeCount = await count(nodeId);
  const initialOtherNodeCount = await count(otherNodeId);
  const resourcePath = roadmapPath(`/nodes/${nodeId}/resources`);

  const uploaded = await ok(
    await author.post(resourcePath, {
      multipart: {
        file: {
          name: resourceTitle,
          mimeType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.7 E2E resource'),
        },
      },
    }),
    201,
  );
  const uploadedResource = (await uploaded.json()).resource;
  await expect.poll(() => resourceNotices(student, nodeId)).toHaveLength(1);
  const afterUpload = await resourceNotices(student, nodeId);
  expect(afterUpload).toHaveLength(1);
  expect(afterUpload[0]).toMatchObject({
    subject: resourceTitle,
    data: { nodeId, resourceTitle, knownResource: null },
  });

  const uploadedPath = roadmapPath(`/resources/${uploadedResource.id}`);
  await ok(await author.patch(uploadedPath, { data: { url: 'not-a-valid-url' } }), 400);
  await expect.poll(() => resourceNotices(student, nodeId)).toHaveLength(1);

  await ok(await author.patch(uploadedPath, { data: { title: resourceTitle } }));
  await expect.poll(() => resourceNotices(student, nodeId)).toHaveLength(1);

  await ok(await author.patch(uploadedPath, { data: { title: updatedTitle } }));
  await ok(await author.delete(uploadedPath), 204);

  await ok(
    await author.post(roadmapPath(`/nodes/${otherNodeId}/resources`), {
      data: {
        title: secondResourceTitle,
        url: 'https://example.test/other-resource',
        type: 'LINK',
      },
    }),
    201,
  );

  await ok(
    await author.patch(roadmapPath(`/nodes/${nodeId}`), {
      data: { description: 'Detalle actualizado' },
    }),
  );

  // The unrecognized addition was removed: only the Node update remains (#181).
  await expect.poll(() => count(nodeId)).toBe(initialNodeCount + 1);
  await expect.poll(() => count(otherNodeId)).toBe(initialOtherNodeCount + 1);
  const noticesBeforeOpening = await getNotices(student, nodeId);
  expect(noticesBeforeOpening.map((notice) => notice.data.noticeTarget)).toContain(
    'node-description',
  );
  expect(noticesBeforeOpening.map((notice) => notice.data.noticeTarget)).not.toContain('resource');

  const studentResourceNotices = await resourceNotices(student, nodeId);
  expect(studentResourceNotices).toHaveLength(0);
  expect(JSON.stringify(await resourceNotices(student, otherNodeId))).not.toMatch(
    /https?:|description|bytes/i,
  );

  expect(await resourceNotices(course.users.teacher, nodeId)).toHaveLength(0);
  expect(await resourceNotices(inactive, nodeId)).toHaveLength(0);
  await expect.poll(() => resourceNotices(teacher, nodeId)).toHaveLength(0);

  await authenticateAs(page.context(), student.id);
  await page.goto('/academic-overview');
  await page.getByRole('button', { name: /^Avisos(,|$)/ }).click();
  await page
    .getByRole('button', {
      name: new RegExp(secondResourceTitle),
    })
    .first()
    .click();
  await expect(page).toHaveURL(course.pagePath());
  await expect(
    page.getByRole('dialog', { name: `Cambios en el Roadmap de ${course.courseCode}` }),
  ).toBeVisible();
  await expect.poll(() => count(nodeId)).toBe(0);
  await expect.poll(() => count(otherNodeId)).toBe(0);

  await ok(
    await author.post(resourcePath, {
      data: {
        title: lateResourceTitle,
        url: 'https://example.test/late-resource',
        type: 'LINK',
      },
    }),
    201,
  );
  await expect.poll(() => count(nodeId)).toBe(1);

  const otherNodeResourceNotices = await resourceNotices(student, otherNodeId);
  expect(otherNodeResourceNotices).toHaveLength(0);
  await ok(await deleteNode(author, roadmapPath(`/nodes/${nodeId}`)), 204);
  await expect.poll(() => resourceNotices(student, nodeId)).toHaveLength(0);
  await expect.poll(() => getNotices(student, nodeId)).toHaveLength(1);
  expect((await getNotices(student, nodeId))[0].data.noticeTarget).toBe('node-deletion');

  await ok(await deleteNode(author, roadmapPath(`/nodes/${otherNodeId}`)), 204);
  const afterOtherCascade = await resourceNotices(student, otherNodeId);
  expect(afterOtherCascade).toHaveLength(0);
});

test('failed Roadmap entry recognition preserves every page and Node without a banner', async ({
  course,
  teacherApi,
  studentApi,
  page,
}) => {
  const { createNode } = await prepareNodeCreator(teacherApi, course);
  const nodeId = (await createNode(`Nodo de avisos ${crypto.randomUUID()}`, 600)).id;
  await createNode(`Otro ${crypto.randomUUID()}`, 1000);
  // Thirteen new Resources of one Node page the Inbox without waiting for deliveries.
  await storeNotices(
    course,
    course.users.studentWithoutProgress.id,
    Array.from({ length: 13 }, (_, index) => {
      const resourceId = crypto.randomUUID();
      return {
        noticeTarget: 'resource',
        targetKey: `resource:${resourceId}`,
        nodeId,
        knownValue: 'null',
        currentValue: JSON.stringify({ title: `Guía ${index}`, revision: 'e2e' }),
        context: { resourceId },
      };
    }),
  );
  await expect
    .poll(() => noticeCount(studentApi, `roadmapId=${course.roadmapId}&nodeId=${nodeId}`))
    .toBe(14);
  await authenticateAs(page.context(), course.users.studentWithoutProgress.id);
  const fail = true;
  const operations: string[] = [];
  await page.route('**/api/notifications/acknowledge', async (route) => {
    operations.push(route.request().postDataJSON().operationId);
    if (fail) await route.abort();
    else await route.continue();
  });
  await page.goto(course.pagePath());
  await expect(page.getByText('No se pudieron reconocer algunos avisos.')).toHaveCount(0);
  const old = await listNotices(studentApi, { roadmapId: course.roadmapId, nodeId, limit: 100 });
  expect(old).toHaveLength(14);
});

test('content notices follow individual prerequisites, teacher policy, inactive exclusion and publication', async ({
  request,
  course,
  apiAs,
  teacherApi,
  createUser,
  createCourse,
}) => {
  const roadmapPath = course.apiPath;
  const author = teacherApi;
  const roadmap = await (await ok(await author.get(roadmapPath()))).json();
  const observer = await createUser();
  const outsider = await createUser();
  // The current persistence model represents observers with the student-equivalent role.
  await sql(
    `INSERT INTO "Participation" ("id", "userId", "courseOfferingId", "role", "isActive") VALUES ('${crypto.randomUUID()}', '${observer.id}', '${course.id}', 'STUDENT', true);`,
  );
  await createCourse({ participants: [{ user: outsider, role: 'STUDENT' }] });
  const without = course.users.studentWithoutProgress;
  const withProgress = course.users.studentWithProgress;
  const assistant = course.users.teachingAssistant;
  const count = async (user: E2EUser, nodeId: string) =>
    noticeCount(await apiAs(user), `nodeId=${nodeId}`);
  const create = async (isVisible: boolean) => {
    const response = await ok(
      await author.post(roadmapPath('/nodes'), {
        data: {
          title: `Audiencia ${crypto.randomUUID()}`,
          description: 'Detalle',
          nodeTypeId: roadmap.nodeTypes[0].id,
          positionX: 0,
          positionY: 0,
          isVisible,
        },
      }),
      201,
    );
    return (await response.json()).node.id as string;
  };
  const prerequisite = await create(true);
  const nodeId = await create(true);
  const hidden = await create(false);
  await expect.poll(() => count(observer, nodeId)).toBe(1);
  for (const excluded of [course.users.teacher, course.users.withdrawnStudent, outsider])
    expect(await count(excluded, nodeId)).toBe(0);
  expect(await count(without, hidden)).toBe(0);
  await author.patch(roadmapPath(`/nodes/${hidden}`), { data: { description: 'Oculto' } });
  expect(await count(without, hidden)).toBe(0);
  await author.patch(roadmapPath(`/nodes/${hidden}`), { data: { isVisible: true } });
  await expect.poll(() => count(without, hidden)).toBe(1);
  // Recognize publication before testing independent content and access targets.
  for (const user of [without, observer, withProgress, assistant])
    await recognize(await apiAs(user), course.roadmapId);
  await createDependency(author, course, prerequisite, nodeId);
  // Dependency access notices are delivered after the HTTP response. Wait for
  // them before capturing the baseline for the subsequent content changes.
  for (const user of [without, observer, withProgress])
    await expect.poll(() => count(user, nodeId)).toBe(1);
  const withProgressApi = await apiAs(withProgress);
  await ok(await withProgressApi.post(roadmapPath(`/nodes/${prerequisite}/completion`)));
  const beforeContent = new Map(
    await Promise.all(
      [without, observer, withProgress, assistant].map(
        async (user) => [user, await count(user, nodeId)] as const,
      ),
    ),
  );
  for (const data of [
    { description: 'Nuevo detalle' },
    { title: 'Nuevo título' },
    { nodeTypeId: roadmap.nodeTypes[1].id },
  ]) {
    await ok(await author.patch(roadmapPath(`/nodes/${nodeId}`), { data }));
  }
  // Title and type are visible even when prerequisites block the Node;
  // description follows the accessible-content audience.
  await expect.poll(() => count(without, nodeId)).toBe(beforeContent.get(without)! + 2);
  await expect.poll(() => count(observer, nodeId)).toBe(beforeContent.get(observer)! + 2);
  await expect
    .poll(() => count(withProgress, nodeId))
    .toBeGreaterThan(beforeContent.get(withProgress)!);
  await expect.poll(() => count(assistant, nodeId)).toBeGreaterThan(beforeContent.get(assistant)!);
  const afterContent = await count(withProgress, nodeId);
  for (const data of [{ title: 'Nuevo título' }, { positionX: 99, positionY: 99 }])
    await author.patch(roadmapPath(`/nodes/${nodeId}`), { data });
  await expect.poll(() => count(withProgress, nodeId)).toBe(afterContent);
  const latest = async (user: E2EUser) =>
    (await listNotices(await apiAs(user), { nodeId }))[0]?.data;
  // The Node type changed last; repeating the title or moving the Node changed nothing.
  const retyped = { noticeTarget: 'node-type', currentValue: roadmap.nodeTypes[1].id };
  await expect.poll(() => latest(withProgress)).toMatchObject(retyped);
  for (const user of [assistant, without, observer])
    expect(await latest(user)).toMatchObject(retyped);
  const opening = { roadmapId: course.roadmapId, operationId: crypto.randomUUID() };
  // Unauthenticated: the shared `request` carries no session cookie.
  await ok(await request.post('/api/notifications/openings', { data: opening }), 401);
  for (const user of [outsider, course.users.withdrawnStudent])
    await ok(await (await apiAs(user)).post('/api/notifications/openings', { data: opening }), 403);
  await ok(
    await withProgressApi.post('/api/notifications/openings', {
      data: { ...opening, retry: true },
    }),
    404,
  );
  await ok(await withProgressApi.post('/api/notifications/openings', { data: opening }));
  await ok(await changeTeacherBlock(author, roadmapPath(`/nodes/${nodeId}`)));
  const blocked = { noticeTarget: 'node-access', currentValue: 'Bloqueado' };
  await expect.poll(() => latest(withProgress)).toMatchObject(blocked);
  await expect.poll(() => latest(assistant)).toMatchObject(blocked);
  const teacherCountAfterBlock = await count(assistant, nodeId);
  const studentCountAfterBlock = await count(withProgress, nodeId);
  await author.patch(roadmapPath(`/nodes/${nodeId}`), {
    data: { description: 'Bloqueado por docencia' },
  });
  await expect.poll(() => count(assistant, nodeId)).toBe(teacherCountAfterBlock);
  await expect.poll(() => count(withProgress, nodeId)).toBe(studentCountAfterBlock);
});

test('Canvas preview and opening the teaching Node leave later notices pending', async ({
  course,
  apiAs,
  teacherApi,
  page,
}) => {
  const recipient = await apiAs(course.users.teachingAssistant);
  const { createNode } = await prepareNodeCreator(teacherApi, course);
  const nodeId = (await createNode(`Preview ${crypto.randomUUID()}`, 600)).id;
  const count = () => noticeCount(recipient, `nodeId=${nodeId}`);
  await authenticateAs(page.context(), course.users.teachingAssistant.id);
  await page.goto(course.pagePath());
  await expect.poll(() => count()).toBe(0);
  await ok(
    await teacherApi.patch(course.apiPath(`/nodes/${nodeId}`), {
      data: { description: 'Cambio posterior a la entrada' },
    }),
  );
  await expect.poll(() => count()).toBe(1);
  await Promise.all([
    page.waitForResponse(
      (response) => response.url().endsWith('/simulation') && response.request().method() === 'GET',
    ),
    page.getByRole('button', { name: 'Vista estudiante' }).click(),
  ]);
  await expect(page.getByText('Previsualización del canvas')).toBeVisible();
  await page.locator(`.react-flow__node[data-id="${nodeId}"]`).click();
  await expect(page.getByRole('button', { name: 'Cerrar detalle' })).toBeVisible();
  await expect.poll(() => count()).toBe(1);
  await page.getByRole('button', { name: 'Ir al editor' }).click();
  await page.locator(`.react-flow__node[data-id="${nodeId}"]`).click();
  await expect.poll(() => count()).toBe(1);
});
