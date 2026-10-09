import { expect, test } from './fixtures';
import { prepareNodeCreator } from './create-node';

test('entry establishes Node knowledge even when creation delivery has not reached the Inbox', async ({
  course,
  apiAs,
  rejectNoticeInserts,
}) => {
  const failure = await rejectNoticeInserts({
    roadmapId: course.roadmapId,
    noticeClass: 'roadmap-node-changed',
  });
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const creator = await prepareNodeCreator(author, course);
  const node = await creator.createNode('Pilas', 0);
  await expect.poll(failure.wasAttempted).toBe(true);
  const notices = async () =>
    (await (await recipient.get(`/api/notifications?nodeId=${node.id}`)).json()).notifications;
  expect(await notices()).toHaveLength(0);
  const opening = { roadmapId: course.roadmapId, operationId: crypto.randomUUID() };
  expect((await recipient.post('/api/notifications/openings', { data: opening })).status()).toBe(
    200,
  );
  expect((await recipient.post('/api/notifications/acknowledge', { data: opening })).status()).toBe(
    200,
  );
  expect(
    (
      await author.post(course.apiPath(`/nodes/${node.id}/resources`), {
        data: {
          title: 'Guía posterior a la entrada',
          type: 'LINK',
          url: 'https://example.test/guide',
        },
      })
    ).status(),
  ).toBe(201);
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0].data).toMatchObject({
    noticeTarget: 'resource',
    changeKind: 'resource-added',
  });
});

test('new Node absorbs content, Resources and blocking, withdraws on hiding and deletion, and returns as new', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const creator = await prepareNodeCreator(author, course);
  const node = await creator.createNode('Colas', 0);
  const path = course.apiPath(`/nodes/${node.id}`);
  const notices = async () =>
    (await (await recipient.get(`/api/notifications?nodeId=${node.id}`)).json()).notifications;
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0].data.noticeTarget).toBe('node-creation');
  const id = (await notices())[0].id;
  expect(
    (
      await author.patch(path, { data: { title: 'Pilas', description: 'Descripción actual' } })
    ).status(),
  ).toBe(200);
  const roadmap = await (await author.get(course.apiPath())).json();
  const type = roadmap.nodeTypes.find((value: { id: string }) => value.id !== creator.nodeTypeId);
  expect((await author.patch(path, { data: { nodeTypeId: type.id } })).status()).toBe(200);
  expect(
    (
      await author.post(`${path}/resources`, {
        data: { title: 'Guía', type: 'LINK', url: 'https://example.test/guide' },
      })
    ).status(),
  ).toBe(201);
  await expect
    .poll(async () => (await notices())[0]?.data.resources)
    .toEqual([expect.objectContaining({ title: 'Guía' })]);
  expect(await notices()).toEqual([
    expect.objectContaining({
      id,
      subject: 'Nuevo Nodo «Pilas»',
      data: expect.objectContaining({ nodeDescription: 'Descripción actual' }),
    }),
  ]);
  expect((await notices())[0].data.nodeTypeName).toBe(type.name);
  expect((await author.post(`${path}/teacher-block`)).status()).toBe(200);
  await expect.poll(async () => (await notices())[0]?.data.nodeAccess).toBe('Bloqueado');
  expect(await notices()).toHaveLength(1);
  expect((await notices())[0].body).toContain('(bloqueado)');
  expect((await author.patch(path, { data: { isVisible: false } })).status()).toBe(200);
  await expect.poll(notices).toHaveLength(0);
  const directlyDeleted = await creator.createNode('Eliminado sin reconocer', 400);
  expect((await author.delete(course.apiPath(`/nodes/${directlyDeleted.id}`))).status()).toBe(204);
  await expect
    .poll(
      async () =>
        (await (await recipient.get(`/api/notifications?nodeId=${directlyDeleted.id}`)).json())
          .notifications,
    )
    .toHaveLength(0);
  expect((await author.patch(path, { data: { isVisible: true } })).status()).toBe(200);
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0].data.noticeTarget).toBe('node-creation');
  expect((await author.delete(path)).status()).toBe(204);
  await expect.poll(notices).toHaveLength(0);
});

test('a Node deleted after the captured entry remains a pending deletion when its creation is recognized', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const creator = await prepareNodeCreator(author, course);
  const node = await creator.createNode('Pilas', 0);
  const notices = async () =>
    (await (await recipient.get(`/api/notifications?nodeId=${node.id}`)).json()).notifications;
  await expect.poll(notices).toHaveLength(1);
  const opening = { roadmapId: course.roadmapId, operationId: crypto.randomUUID() };
  expect((await recipient.post('/api/notifications/openings', { data: opening })).status()).toBe(
    200,
  );
  expect((await author.delete(course.apiPath(`/nodes/${node.id}`))).status()).toBe(204);
  await expect.poll(notices).toHaveLength(0);
  expect((await recipient.post('/api/notifications/acknowledge', { data: opening })).status()).toBe(
    200,
  );
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0].data.changeKind).toBe('node-deleted');
});

test('recognizing a new Node rebases absorbed values and preserves changes after the captured entry', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const creator = await prepareNodeCreator(author, course);
  const node = await creator.createNode('Colas', 0);
  const path = course.apiPath(`/nodes/${node.id}`);
  const notices = async () =>
    (await (await recipient.get(`/api/notifications?nodeId=${node.id}`)).json()).notifications;
  expect((await author.patch(path, { data: { title: 'Pilas' } })).status()).toBe(200);
  await expect.poll(async () => (await notices())[0]?.data.nodeTitle).toBe('Pilas');
  const opening = { roadmapId: course.roadmapId, operationId: crypto.randomUUID() };
  expect((await recipient.post('/api/notifications/openings', { data: opening })).status()).toBe(
    200,
  );
  expect((await author.patch(path, { data: { title: 'Pilas avanzadas' } })).status()).toBe(200);
  await expect.poll(async () => (await notices())[0]?.data.nodeTitle).toBe('Pilas avanzadas');
  expect((await recipient.post('/api/notifications/acknowledge', { data: opening })).status()).toBe(
    200,
  );
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0].data).toMatchObject({
    noticeTarget: 'node-title',
    knownTitle: 'Pilas',
    currentTitle: 'Pilas avanzadas',
  });
  expect((await recipient.post('/api/notifications/acknowledge', { data: opening })).status()).toBe(
    200,
  );
  expect(await notices()).toHaveLength(1);
  expect((await author.patch(path, { data: { title: 'Pilas' } })).status()).toBe(200);
  await expect.poll(notices).toHaveLength(0);
});

test('pending Roadmap availability absorbs every later notice and recognition establishes the current baseline', async ({
  course,
  createCourse,
  apiAs,
}) => {
  const offering = await createCourse({
    roadmap: false,
    participants: [
      { user: course.users.teacher, role: 'TEACHER' },
      { user: course.users.studentWithoutProgress, role: 'STUDENT' },
    ],
  });
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const response = await author.post(offering.apiPath(), { data: {} });
  expect(response.status()).toBe(201);
  const roadmapId = (await response.json()).roadmap.id;
  const notices = async () =>
    (await (await recipient.get(`/api/notifications?roadmapId=${roadmapId}`)).json()).notifications;
  await expect.poll(notices).toHaveLength(1);
  const creator = await prepareNodeCreator(author, offering);
  const node = await creator.createNode('Colas', 0);
  const path = offering.apiPath(`/nodes/${node.id}`);
  expect(
    (await author.patch(path, { data: { title: 'Pilas', description: 'Actual' } })).status(),
  ).toBe(200);
  expect(
    (
      await author.post(`${path}/resources`, {
        data: { title: 'Guía', type: 'LINK', url: 'https://example.test/guide' },
      })
    ).status(),
  ).toBe(201);
  const removed = await creator.createNode('Eliminado antes de entrar', 200);
  expect((await author.delete(offering.apiPath(`/nodes/${removed.id}`))).status()).toBe(204);
  const dependent = await creator.createNode('Colas avanzadas', 500);
  // The title edit is committed; deferred absorption can only retain the availability row.
  expect(await notices()).toEqual([
    expect.objectContaining({ data: expect.objectContaining({ changeKind: 'roadmap-available' }) }),
  ]);
  const opening = { roadmapId, operationId: crypto.randomUUID() };
  expect((await recipient.post('/api/notifications/openings', { data: opening })).status()).toBe(
    200,
  );
  expect(
    (
      await author.post(offering.apiPath('/dependencies'), {
        data: { sourceNodeId: node.id, targetNodeId: dependent.id },
      })
    ).status(),
  ).toBe(201);
  const later = await creator.createNode('Llegada posterior a la entrada', 900);
  expect(await notices()).toHaveLength(1);
  expect((await recipient.post('/api/notifications/acknowledge', { data: opening })).status()).toBe(
    200,
  );
  await expect.poll(notices).toHaveLength(3);
  const pending = await notices();
  expect(pending).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        data: expect.objectContaining({
          noticeTarget: 'dependency',
          knownValue: 'false',
          currentValue: 'true',
        }),
      }),
      expect.objectContaining({
        data: expect.objectContaining({ noticeTarget: 'node-creation', nodeId: later.id }),
      }),
      expect.objectContaining({
        data: expect.objectContaining({ noticeTarget: 'node-access', nodeId: dependent.id }),
      }),
    ]),
  );
  const nextOpening = { roadmapId, operationId: crypto.randomUUID() };
  expect(
    (await recipient.post('/api/notifications/openings', { data: nextOpening })).status(),
  ).toBe(200);
  expect(
    (await recipient.post('/api/notifications/acknowledge', { data: nextOpening })).status(),
  ).toBe(200);
  await expect.poll(notices).toHaveLength(0);
  expect((await author.patch(path, { data: { title: 'Pilas avanzadas' } })).status()).toBe(200);
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0].data).toMatchObject({
    noticeTarget: 'node-title',
    knownTitle: 'Pilas',
    currentTitle: 'Pilas avanzadas',
  });
});

test('deleting a known Node absorbs pending title, access and Resource targets', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const path = course.apiPath(`/nodes/${course.nodes.first}`);
  const notices = async () =>
    (await (await recipient.get(`/api/notifications?nodeId=${course.nodes.first}`)).json())
      .notifications;
  expect((await author.patch(path, { data: { title: 'Pilas' } })).status()).toBe(200);
  expect(
    (
      await author.post(`${path}/resources`, {
        data: { title: 'Guía', type: 'LINK', url: 'https://example.test/guide' },
      })
    ).status(),
  ).toBe(201);
  await expect.poll(notices).toHaveLength(2);
  expect((await author.post(`${path}/teacher-block`)).status()).toBe(200);
  await expect
    .poll(async () =>
      (await notices())
        .map((notice: { data: { noticeTarget: string } }) => notice.data.noticeTarget)
        .sort(),
    )
    .toEqual(['node-access', 'node-title']);
  expect((await author.delete(path)).status()).toBe(204);
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0].data.changeKind).toBe('node-deleted');
});
