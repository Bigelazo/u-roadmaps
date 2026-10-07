import { expect, test } from './fixtures';

type RouteNotice = { id: string; body: string; data: Record<string, unknown> };

test('removing and re-adding a Dependency with a new id withdraws the same pair target', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithProgress);
  const roadmap = await (await author.get(course.apiPath())).json();
  const dependency = roadmap.dependencies[0];
  const pair = { sourceNodeId: dependency.sourceNodeId, targetNodeId: dependency.targetNodeId };
  const notices = async () =>
    (
      (
        await (
          await recipient.get(`/api/notifications?roadmapId=${course.roadmapId}&limit=100`)
        ).json()
      ).notifications as RouteNotice[]
    ).filter(
      ({ data }) =>
        data.sourceNodeId === pair.sourceNodeId && data.targetNodeId === pair.targetNodeId,
    );
  expect((await author.delete(course.apiPath(`/dependencies/${dependency.id}`))).status()).toBe(
    204,
  );
  await expect
    .poll(notices)
    .toMatchObject([
      { data: { changeKind: 'dependency-removed', knownValue: 'true', currentValue: 'false' } },
    ]);
  const readded = await author.post(course.apiPath('/dependencies'), { data: pair });
  expect(readded.status()).toBe(201);
  expect((await readded.json()).dependency.id).not.toBe(dependency.id);
  await expect.poll(notices).toHaveLength(0);
  const current = await (await author.get(course.apiPath())).json();
  const replacement = current.dependencies.find(
    (edge: typeof pair) =>
      edge.sourceNodeId === pair.sourceNodeId && edge.targetNodeId === pair.targetNodeId,
  );
  expect((await author.delete(course.apiPath(`/dependencies/${replacement.id}`))).status()).toBe(
    204,
  );
  await expect.poll(notices).toMatchObject([{ data: { changeKind: 'dependency-removed' } }]);
  const opening = { roadmapId: course.roadmapId, operationId: crypto.randomUUID() };
  expect((await recipient.post('/api/notifications/openings', { data: opening })).status()).toBe(
    200,
  );
  expect((await recipient.post('/api/notifications/acknowledge', { data: opening })).status()).toBe(
    200,
  );
  expect((await author.post(course.apiPath('/dependencies'), { data: pair })).status()).toBe(201);
  await expect
    .poll(notices)
    .toMatchObject([
      { data: { changeKind: 'dependency-added', knownValue: 'false', currentValue: 'true' } },
    ]);
});

test('Node type renames retain the known name and withdraw a return; appearance changes stay silent', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const created = await author.post(course.apiPath('/node-types'), {
    data: { name: 'Lectura', icon: 'BookOpen', color: '#024AD8' },
  });
  expect(created.status()).toBe(201);
  const typeId = (await created.json()).nodeType.id;
  expect(
    (
      await author.patch(course.apiPath(`/nodes/${course.nodes.first}`), {
        data: { nodeTypeId: typeId },
      })
    ).status(),
  ).toBe(200);
  const notices = async () =>
    (
      (
        await (
          await recipient.get(`/api/notifications?roadmapId=${course.roadmapId}&limit=100`)
        ).json()
      ).notifications as RouteNotice[]
    ).filter(({ data }) => data.noticeTarget === 'node-type-name' && data.nodeTypeId === typeId);
  const rename = async (name: string) =>
    expect(
      (await author.patch(course.apiPath(`/node-types/${typeId}`), { data: { name } })).status(),
    ).toBe(200);
  await rename('Lectura guiada');
  await expect.poll(notices).toHaveLength(1);
  const firstId = (await notices())[0].id;
  await rename('Lectura obligatoria');
  await expect
    .poll(notices)
    .toMatchObject([
      { id: firstId, body: 'El tipo «Lectura» ahora se llama «Lectura obligatoria».' },
    ]);
  await rename('Lectura');
  await expect.poll(notices).toHaveLength(0);
  expect(
    (
      await author.patch(course.apiPath(`/node-types/${typeId}`), {
        data: { icon: 'BookText', color: '#1467A8' },
      })
    ).status(),
  ).toBe(200);
  expect(await notices()).toHaveLength(0);
  await rename('Taller');
  await expect.poll(notices).toHaveLength(1);
  const opening = { roadmapId: course.roadmapId, operationId: crypto.randomUUID() };
  expect((await recipient.post('/api/notifications/openings', { data: opening })).status()).toBe(
    200,
  );
  expect((await recipient.post('/api/notifications/acknowledge', { data: opening })).status()).toBe(
    200,
  );
  await rename('Seminario');
  await expect
    .poll(notices)
    .toMatchObject([{ body: 'El tipo «Taller» ahora se llama «Seminario».' }]);
});
