import { expect, test } from './fixtures';
import { createDependency, prepareNodeCreator } from './create-node';
import { ok } from './helpers';
import { acknowledgeOpening, listNotices, prepareOpening, recognize } from './notices';
import { changeTeacherBlock, deleteNode, hideNode } from './previewed-writes';

test('entry establishes Node knowledge even when creation delivery has not reached the Inbox', async ({
  course,
  teacherApi: author,
  studentApi: recipient,
  rejectNoticeInserts,
}) => {
  const failure = await rejectNoticeInserts({
    roadmapId: course.roadmapId,
    noticeClass: 'roadmap-node-changed',
  });
  const creator = await prepareNodeCreator(author, course);
  const node = await creator.createNode('Pilas', 0);
  await expect.poll(failure.wasAttempted).toBe(true);
  const notices = () => listNotices(recipient, { nodeId: node.id });
  expect(await notices()).toHaveLength(0);
  await recognize(recipient, course.roadmapId);
  await ok(
    await author.post(course.apiPath(`/nodes/${node.id}/resources`), {
      data: {
        title: 'Guía posterior a la entrada',
        type: 'LINK',
        url: 'https://example.test/guide',
      },
    }),
    201,
  );
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0].data).toMatchObject({
    noticeTarget: 'resource',
    knownResource: null,
  });
});

test('new Node absorbs content, Resources and blocking, withdraws on hiding and deletion, and returns as new', async ({
  course,
  teacherApi: author,
  studentApi: recipient,
}) => {
  const creator = await prepareNodeCreator(author, course);
  const node = await creator.createNode('Colas', 0);
  const path = course.apiPath(`/nodes/${node.id}`);
  const notices = () => listNotices(recipient, { nodeId: node.id });
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0].data.noticeTarget).toBe('node-creation');
  const id = (await notices())[0].id;
  await ok(
    await author.patch(path, { data: { title: 'Pilas', description: 'Descripción actual' } }),
  );
  const roadmap = await (await author.get(course.apiPath())).json();
  const type = roadmap.nodeTypes.find((value: { id: string }) => value.id !== creator.nodeTypeId);
  await ok(await author.patch(path, { data: { nodeTypeId: type.id } }));
  await ok(
    await author.post(`${path}/resources`, {
      data: { title: 'Guía', type: 'LINK', url: 'https://example.test/guide' },
    }),
    201,
  );
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
  await ok(await changeTeacherBlock(author, path));
  await expect.poll(async () => (await notices())[0]?.data.nodeAccess).toBe('Bloqueado');
  expect(await notices()).toHaveLength(1);
  expect((await notices())[0].body).toContain('(bloqueado)');
  await ok(await hideNode(author, path));
  await expect.poll(notices).toHaveLength(0);
  const directlyDeleted = await creator.createNode('Eliminado sin reconocer', 400);
  await ok(await deleteNode(author, course.apiPath(`/nodes/${directlyDeleted.id}`)), 204);
  await expect.poll(() => listNotices(recipient, { nodeId: directlyDeleted.id })).toHaveLength(0);
  await ok(await author.patch(path, { data: { isVisible: true } }));
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0].data.noticeTarget).toBe('node-creation');
  await ok(await deleteNode(author, path), 204);
  await expect.poll(notices).toHaveLength(0);
});

test('a Node deleted after the captured entry remains a pending deletion when its creation is recognized', async ({
  course,
  teacherApi: author,
  studentApi: recipient,
}) => {
  const creator = await prepareNodeCreator(author, course);
  const node = await creator.createNode('Pilas', 0);
  const notices = () => listNotices(recipient, { nodeId: node.id });
  await expect.poll(notices).toHaveLength(1);
  const opening = await prepareOpening(recipient, course.roadmapId);
  await ok(await deleteNode(author, course.apiPath(`/nodes/${node.id}`)), 204);
  await expect.poll(notices).toHaveLength(0);
  await acknowledgeOpening(recipient, opening);
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0].data.noticeTarget).toBe('node-deletion');
});

test('recognizing a new Node rebases absorbed values and preserves changes after the captured entry', async ({
  course,
  teacherApi: author,
  studentApi: recipient,
}) => {
  const creator = await prepareNodeCreator(author, course);
  const node = await creator.createNode('Colas', 0);
  const path = course.apiPath(`/nodes/${node.id}`);
  const notices = () => listNotices(recipient, { nodeId: node.id });
  await ok(await author.patch(path, { data: { title: 'Pilas' } }));
  await expect.poll(async () => (await notices())[0]?.data.nodeTitle).toBe('Pilas');
  const opening = await prepareOpening(recipient, course.roadmapId);
  await ok(await author.patch(path, { data: { title: 'Pilas avanzadas' } }));
  await expect.poll(async () => (await notices())[0]?.data.nodeTitle).toBe('Pilas avanzadas');
  await acknowledgeOpening(recipient, opening);
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0].data).toMatchObject({
    noticeTarget: 'node-title',
    knownTitle: 'Pilas',
    currentTitle: 'Pilas avanzadas',
  });
  await acknowledgeOpening(recipient, opening);
  expect(await notices()).toHaveLength(1);
  await ok(await author.patch(path, { data: { title: 'Pilas' } }));
  await expect.poll(notices).toHaveLength(0);
});

test('pending Roadmap availability absorbs every later notice and recognition establishes the current baseline', async ({
  course,
  createCourse,
  teacherApi: author,
  studentApi: recipient,
}) => {
  const offering = await createCourse({
    roadmap: false,
    participants: [
      { user: course.users.teacher, role: 'TEACHER' },
      { user: course.users.studentWithoutProgress, role: 'STUDENT' },
    ],
  });
  const response = await ok(await author.post(offering.apiPath(), { data: {} }), 201);
  const roadmapId = (await response.json()).roadmap.id;
  const notices = () => listNotices(recipient, { roadmapId });
  await expect.poll(notices).toHaveLength(1);
  const creator = await prepareNodeCreator(author, offering);
  const node = await creator.createNode('Colas', 0);
  const path = offering.apiPath(`/nodes/${node.id}`);
  await ok(await author.patch(path, { data: { title: 'Pilas', description: 'Actual' } }));
  await ok(
    await author.post(`${path}/resources`, {
      data: { title: 'Guía', type: 'LINK', url: 'https://example.test/guide' },
    }),
    201,
  );
  const removed = await creator.createNode('Eliminado antes de entrar', 200);
  await ok(await deleteNode(author, offering.apiPath(`/nodes/${removed.id}`)), 204);
  const dependent = await creator.createNode('Colas avanzadas', 500);
  expect(await notices()).toEqual([
    expect.objectContaining({
      data: expect.objectContaining({ noticeTarget: 'roadmap-availability' }),
    }),
  ]);
  const opening = await prepareOpening(recipient, roadmapId);
  await createDependency(author, offering, node.id, dependent.id);
  const later = await creator.createNode('Llegada posterior a la entrada', 900);
  expect(await notices()).toHaveLength(1);
  await acknowledgeOpening(recipient, opening);
  await expect.poll(notices).toHaveLength(3);
  const pending = await notices();
  expect(pending).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        data: expect.objectContaining({
          noticeTarget: 'dependency',
          knownValue: 'absent',
          currentValue: 'present',
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
  await recognize(recipient, roadmapId);
  await expect.poll(notices).toHaveLength(0);
  await ok(await author.patch(path, { data: { title: 'Pilas avanzadas' } }));
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0].data).toMatchObject({
    noticeTarget: 'node-title',
    knownTitle: 'Pilas',
    currentTitle: 'Pilas avanzadas',
  });
});

test('deleting a known Node absorbs pending title, access and Resource targets', async ({
  course,
  teacherApi: author,
  studentApi: recipient,
}) => {
  const path = course.apiPath(`/nodes/${course.nodes.first}`);
  const notices = () => listNotices(recipient, { nodeId: course.nodes.first });
  await ok(await author.patch(path, { data: { title: 'Pilas' } }));
  await ok(
    await author.post(`${path}/resources`, {
      data: { title: 'Guía', type: 'LINK', url: 'https://example.test/guide' },
    }),
    201,
  );
  await expect.poll(notices).toHaveLength(2);
  await ok(await changeTeacherBlock(author, path));
  await expect
    .poll(async () => (await notices()).map((notice) => notice.data.noticeTarget).sort())
    .toEqual(['node-access', 'node-title']);
  await ok(await deleteNode(author, path), 204);
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0].data.noticeTarget).toBe('node-deletion');
});
