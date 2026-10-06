import { expect, test } from './fixtures';
import { sql } from './database';
import { createExistingNode } from './existing-node';
import { authenticateAs, sessionCookie } from './helpers';

type StoredNotice = Readonly<{
  id: string;
  subject: string;
  body: string;
  read: boolean;
  data: Record<string, unknown>;
}>;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('access notices retain context through blocking, unlocking, hiding and deletion', async ({
  request,
  course,
  page,
}) => {
  const roadmapPath = course.apiPath;
  const author = { cookie: await sessionCookie(course.users.teacher.id) };
  const student = course.users.studentWithProgress.id;
  const withoutProgress = course.users.studentWithoutProgress.id;
  const roadmap = await (await request.get(roadmapPath(), { headers: author })).json();
  // Existing visible Nodes avoid creation notices during these access changes.
  const existingNode = async (title: string) => {
    const id = await createExistingNode({
      roadmapId: roadmap.roadmap.id,
      nodeTypeId: roadmap.nodeTypes[0].id,
      title,
      description: 'Detalle privado',
      positionX: 600,
    });
    return id;
  };
  const noticesFor = async (userId: string, nodeId: string) => {
    const response = await request.get(`/api/notifications?nodeId=${nodeId}&limit=100`, {
      headers: { cookie: await sessionCookie(userId) },
    });
    expect(response.status()).toBe(200);
    return (await response.json()).notifications as StoredNotice[];
  };
  const selectNotice = async (nodeId: string, title: string) => {
    await authenticateAs(page.context(), student);
    await page.goto('/academic-overview');
    await page.getByRole('button', { name: /^Avisos(,|$)/ }).click();
    await page
      .getByRole('list', { name: 'Lista de avisos' })
      .getByRole('button', { name: new RegExp(`^${escapeRegExp(title)}`) })
      .first()
      .click();
    // Repeats are stored immediately without a summary (no grouping window, see ADR-0014).
    await expect(page.getByRole('dialog', { name: title, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cerrar detalle' })).toHaveCount(0);
    await expect(page).not.toHaveURL(/targetNode=/);
    await expect
      .poll(async () => (await noticesFor(student, nodeId)).filter(({ read }) => !read).length)
      .toBe(0);
  };
  const rootTitle = `Acceso inicial ${crypto.randomUUID()}`;
  const dependentTitle = `Acceso dependiente ${crypto.randomUUID()}`;
  const rootId = await existingNode(rootTitle);
  const dependentId = await existingNode(dependentTitle);
  await sql(
    `INSERT INTO "Dependency" ("id", "sourceNodeId", "targetNodeId") VALUES ('${crypto.randomUUID()}', '${rootId}', '${dependentId}'); INSERT INTO "Completion" ("id", "userId", "roadmapNodeId") VALUES ('${crypto.randomUUID()}', '${student}', '${rootId}');`,
  );
  expect(
    (
      await request.post(roadmapPath(`/nodes/${rootId}/teacher-block`), { headers: author })
    ).status(),
  ).toBe(200);
  expect((await noticesFor(withoutProgress, rootId))[0]).toMatchObject({
    subject: rootTitle,
    data: { changeKind: 'node-blocked', targetKind: 'roadmap', nodeTitle: rootTitle },
  });
  expect(await noticesFor(withoutProgress, dependentId)).toHaveLength(0);
  expect((await noticesFor(student, dependentId))[0]).toMatchObject({
    data: { changeKind: 'node-blocked', targetKind: 'roadmap' },
  });
  const version = async (operation: string) =>
    (
      await (
        await request.get(roadmapPath(`/nodes/${rootId}/teacher-block?operation=${operation}`), {
          headers: author,
        })
      ).json()
    ).version;
  expect(
    (
      await request.delete(roadmapPath(`/nodes/${rootId}/teacher-block`), {
        headers: { ...author, 'x-teacher-block-preview': await version('UNBLOCK') },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.patch(roadmapPath(`/nodes/${rootId}/teacher-block`), {
        headers: { ...author, 'x-teacher-block-preview': await version('BRANCH_UNLOCK') },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post(roadmapPath(`/nodes/${dependentId}/teacher-block`), { headers: author })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.patch(roadmapPath(`/nodes/${rootId}`), {
        headers: author,
        data: { isVisible: false },
      })
    ).status(),
  ).toBe(200);

  const removedTitle = `Eliminación bloqueada ${crypto.randomUUID()}`;
  const removedId = await existingNode(removedTitle);
  const resource = await request.post(roadmapPath(`/nodes/${removedId}/resources`), {
    headers: author,
    data: {
      title: 'Material previo',
      url: 'https://example.test/access-notice-resource',
      type: 'LINK',
    },
  });
  expect(resource.status()).toBe(201);
  expect(
    (
      await request.post(roadmapPath(`/nodes/${removedId}/teacher-block`), { headers: author })
    ).status(),
  ).toBe(200);
  expect(
    (await request.delete(roadmapPath(`/nodes/${removedId}`), { headers: author })).status(),
  ).toBe(204);

  await expect
    .poll(async () => (await noticesFor(student, removedId))[0]?.data.changeKind)
    .toBe('node-deleted');
  const retired = (await noticesFor(student, rootId))[0];
  expect(retired).toMatchObject({
    subject: rootTitle,
    data: { changeKind: 'node-retired', targetKind: 'roadmap', nodeTitle: rootTitle },
  });
  expect(JSON.stringify(retired)).not.toContain('Detalle privado');
  const deletionNotices = await noticesFor(student, removedId);
  expect(deletionNotices.map(({ data }) => data.changeKind)).toEqual([
    'node-deleted',
    'node-blocked',
    'resource-added',
  ]);
  expect(deletionNotices[0]).toMatchObject({
    subject: removedTitle,
    data: { eventCount: 1, targetKind: 'roadmap', nodeTitle: removedTitle },
  });
  expect((await noticesFor(withoutProgress, removedId))[0].data.changeKind).toBe('node-deleted');
  expect(await noticesFor(course.users.withdrawnStudent.id, removedId)).toHaveLength(0);
  expect(await noticesFor(course.users.teacher.id, removedId)).toHaveLength(0);
  await selectNotice(rootId, rootTitle);
  await selectNotice(removedId, removedTitle);
});

test('a PostgreSQL access-notice failure leaves the Node visibility change committed', async ({
  request,
  course,
  rejectNoticeInserts,
}) => {
  const roadmapPath = course.apiPath;
  const author = { cookie: await sessionCookie(course.users.teacher.id) };
  const student = { cookie: await sessionCookie(course.users.studentWithoutProgress.id) };
  const roadmap = await (await request.get(roadmapPath(), { headers: author })).json();
  const nodeId = await createExistingNode({
    roadmapId: roadmap.roadmap.id,
    nodeTypeId: roadmap.nodeTypes[0].id,
    title: 'Fallo de aviso',
    positionX: 5600,
  });
  const failure = await rejectNoticeInserts({ roadmapId: course.roadmapId });

  const hidden = await request.patch(roadmapPath(`/nodes/${nodeId}`), {
    headers: author,
    data: { isVisible: false },
  });
  expect(hidden.status()).toBe(200);
  expect((await hidden.json()).node).toMatchObject({ id: nodeId, isVisible: false });

  const persistedNodes = await request.get(roadmapPath('/nodes'), { headers: author });
  expect(persistedNodes.status()).toBe(200);
  expect(
    (await persistedNodes.json()).nodes.find(({ id }: { id: string }) => id === nodeId),
  ).toMatchObject({ id: nodeId, isVisible: false });
  expect(await failure.wasAttempted()).toBe(true);

  const notices = await request.get(
    `/api/notifications?roadmapId=${roadmap.roadmap.id}&nodeId=${nodeId}`,
    { headers: student },
  );
  expect(notices.status()).toBe(200);
  expect((await notices.json()).notifications).toHaveLength(0);
});

test('lost Course access retains saved notices and acknowledges only the selected one', async ({
  request,
  course,
  page,
}) => {
  const roadmapPath = course.apiPath;
  const author = { cookie: await sessionCookie(course.users.teacher.id) };
  const userId = course.users.studentWithoutProgress.id;
  const roadmap = await (await request.get(roadmapPath(), { headers: author })).json();
  const nodeIds: string[] = [];
  const createNode = async (title: string) => {
    const response = await request.post(roadmapPath('/nodes'), {
      headers: author,
      data: {
        title,
        nodeTypeId: roadmap.nodeTypes[0].id,
        positionX: 600 + nodeIds.length * 400,
        positionY: 0,
      },
    });
    expect(response.status()).toBe(201);
    const id = (await response.json()).node.id as string;
    nodeIds.push(id);
    return id;
  };
  const allNotices = async () => {
    const response = await request.get(
      `/api/notifications?courseCode=${course.courseCode}&year=${course.year}&semester=${course.semester}&limit=100`,
      { headers: { cookie: await sessionCookie(userId) } },
    );
    expect(response.status()).toBe(200);
    return (await response.json()).notifications as StoredNotice[];
  };

  const firstTitle = `Aviso conservado A ${crypto.randomUUID()}`;
  const secondTitle = `Aviso conservado B ${crypto.randomUUID()}`;
  const firstId = await createNode(firstTitle);
  const secondId = await createNode(secondTitle);
  expect((await allNotices()).map(({ subject }) => subject)).toEqual([secondTitle, firstTitle]);

  await sql(
    `UPDATE "Participation" SET "isActive" = false WHERE "userId" = '${userId}' AND "courseOfferingId" = '${course.id}';`,
  );
  await createNode(`Aviso posterior ${crypto.randomUUID()}`);
  const retained = await allNotices();
  expect(retained).toHaveLength(2);
  expect(retained.find(({ subject }) => subject === firstTitle)).toMatchObject({
    data: { nodeId: firstId, targetKind: 'node' },
  });
  expect(retained.find(({ subject }) => subject === secondTitle)).toMatchObject({
    data: { nodeId: secondId, targetKind: 'node' },
  });

  await authenticateAs(page.context(), userId);
  await page.goto('/academic-overview');
  await page.getByRole('button', { name: /^Avisos(,|$)/ }).click();
  await page
    .getByRole('list', { name: 'Lista de avisos' })
    .getByRole('button', { name: new RegExp(escapeRegExp(firstTitle)) })
    .click();
  await expect(page).toHaveURL(/\/academic-overview\?.*noticeFallback=course-unavailable/);
  await expect(
    page.getByRole('status').filter({ hasText: 'No se puede abrir este Roadmap' }),
  ).toContainText('Tu Participación ya no tiene acceso a este Curso.');
  await expect
    .poll(async () => (await allNotices()).find(({ subject }) => subject === firstTitle)?.read)
    .toBe(true);
  expect((await allNotices()).find(({ subject }) => subject === secondTitle)?.read).toBe(false);
});
