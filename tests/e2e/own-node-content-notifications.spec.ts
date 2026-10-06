import { expect, test } from './fixtures';

test('blocked students receive title and type targets; accessible students also receive description', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const blocked = await apiAs(course.users.studentWithoutProgress);
  const accessible = await apiAs(course.users.studentWithProgress);
  const roadmap = await (await author.get(course.apiPath())).json();
  const node = roadmap.nodes.find((value: { id: string }) => value.id === course.nodes.second);
  const nextType = roadmap.nodeTypes.find((value: { id: string }) => value.id !== node.nodeTypeId);
  expect(
    (
      await author.patch(course.apiPath(`/nodes/${node.id}`), {
        data: { title: 'Pilas', description: 'Descripción nueva', nodeTypeId: nextType.id },
      })
    ).status(),
  ).toBe(200);
  const targets = async (api: typeof blocked) => {
    const response = await api.get(`/api/notifications?nodeId=${node.id}&read=false`);
    expect(response.status()).toBe(200);
    return (await response.json()).notifications
      .map((notice: { data: { noticeTarget: string } }) => notice.data.noticeTarget)
      .sort();
  };
  await expect.poll(() => targets(blocked)).toEqual(['node-title', 'node-type']);
  await expect
    .poll(() => targets(accessible))
    .toEqual(['node-description', 'node-title', 'node-type']);
});

test('description and type targets absorb edits independently, withdraw exact returns, and retain assignment names', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const roadmap = await (await author.get(course.apiPath())).json();
  const node = roadmap.nodes.find((value: { id: string }) => value.id === course.nodes.first);
  const path = course.apiPath(`/nodes/${node.id}`);
  const notices = async () =>
    (await (await recipient.get(`/api/notifications?nodeId=${node.id}&read=false`)).json())
      .notifications;
  const edit = async (data: Record<string, unknown>) =>
    expect((await author.patch(path, { data })).status()).toBe(200);
  const createType = async (name: string) => {
    const response = await author.post(course.apiPath('/node-types'), {
      data: { name, icon: 'BookOpen', color: '#024AD8' },
    });
    expect(response.status()).toBe(201);
    return (await response.json()).nodeType;
  };
  const typeB = await createType('Lectura');
  const typeC = await createType('Taller');
  await edit({ description: 'Primera descripción' });
  await expect.poll(notices).toHaveLength(1);
  const descriptionId = (await notices())[0].id;
  await edit({ description: 'Segunda descripción' });
  await expect
    .poll(async () => (await notices())[0]?.data.currentValue)
    .toBe('"Segunda descripción"');
  expect((await notices())[0]).toMatchObject({
    id: descriptionId,
    body: `Se actualizó la descripción de «${node.title}».`,
  });
  await edit({ title: 'Pilas', nodeTypeId: typeB.id });
  await expect.poll(notices).toHaveLength(3);
  const typeNotice = (await notices()).find(
    (notice: { data: { noticeTarget: string } }) => notice.data.noticeTarget === 'node-type',
  );
  await edit({ nodeTypeId: typeC.id });
  await expect
    .poll(
      async () =>
        (await notices()).find((notice: { id: string }) => notice.id === typeNotice.id)?.data
          .currentTypeName,
    )
    .toBe('Taller');
  expect((await notices()).find((notice: { id: string }) => notice.id === typeNotice.id).body).toBe(
    `«Pilas» pasó de tipo «${roadmap.nodeTypes.find((type: { id: string }) => type.id === node.nodeTypeId).name}» a tipo «Taller».`,
  );
  expect(
    (
      await author.patch(course.apiPath(`/node-types/${typeC.id}`), {
        data: { name: 'Taller renombrado' },
      })
    ).status(),
  ).toBe(200);
  // Wait for the separate classification effect to commit before checking the pending assignment.
  await expect
    .poll(async () =>
      (
        await (await recipient.get(`/api/notifications?roadmapId=${course.roadmapId}`)).json()
      ).notifications.some(
        (notice: { data: { changeKind: string } }) =>
          notice.data.changeKind === 'classification-updated',
      ),
    )
    .toBe(true);
  expect(
    (await notices()).find((notice: { id: string }) => notice.id === typeNotice.id).data,
  ).toMatchObject({ currentTypeName: 'Taller' });
  await edit({ description: `${node.description ?? ''} ` });
  await expect.poll(notices).toHaveLength(3);
  await edit({ description: node.description });
  await expect.poll(notices).toHaveLength(2);
  await edit({ nodeTypeId: node.nodeTypeId });
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0].data.noticeTarget).toBe('node-title');
});

test('recognition rebases later description and type edits and retries do not recognize them', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const roadmap = await (await author.get(course.apiPath())).json();
  const node = roadmap.nodes.find((value: { id: string }) => value.id === course.nodes.first);
  const types = roadmap.nodeTypes.filter((value: { id: string }) => value.id !== node.nodeTypeId);
  const path = course.apiPath(`/nodes/${node.id}`);
  const notices = async () =>
    (await (await recipient.get(`/api/notifications?nodeId=${node.id}&read=false`)).json())
      .notifications;
  expect(
    (
      await author.patch(path, {
        data: { description: 'Descripción reconocida', nodeTypeId: types[0].id },
      })
    ).status(),
  ).toBe(200);
  await expect.poll(notices).toHaveLength(2);
  const opening = { roadmapId: course.roadmapId, operationId: crypto.randomUUID() };
  expect((await recipient.post('/api/notifications/openings', { data: opening })).status()).toBe(
    200,
  );
  expect(
    (
      await author.patch(path, {
        data: { description: 'Descripción posterior', nodeTypeId: types[1].id },
      })
    ).status(),
  ).toBe(200);
  await expect
    .poll(
      async () =>
        (await notices()).find(
          (notice: { data: { noticeTarget: string } }) => notice.data.noticeTarget === 'node-type',
        )?.data.currentValue,
    )
    .toBe(types[1].id);
  for (let retry = 0; retry < 2; retry++) {
    expect(
      (await recipient.post('/api/notifications/acknowledge', { data: opening })).status(),
    ).toBe(200);
    const pending = await notices();
    expect(pending).toHaveLength(2);
    expect(
      pending.find(
        (notice: { data: { noticeTarget: string } }) =>
          notice.data.noticeTarget === 'node-description',
      ).data,
    ).toMatchObject({
      knownValue: '"Descripción reconocida"',
      currentValue: '"Descripción posterior"',
    });
    expect(
      pending.find(
        (notice: { data: { noticeTarget: string } }) => notice.data.noticeTarget === 'node-type',
      ).data,
    ).toMatchObject({
      knownValue: types[0].id,
      knownTypeName: types[0].name,
      currentValue: types[1].id,
      currentTypeName: types[1].name,
    });
  }
  expect(
    (
      await author.patch(path, {
        data: { description: 'Descripción reconocida', nodeTypeId: types[0].id },
      })
    ).status(),
  ).toBe(200);
  await expect.poll(notices).toHaveLength(0);
});

test('description changes while blocked do not seed knowledge the recipient never saw', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const roadmap = await (await author.get(course.apiPath())).json();
  const node = roadmap.nodes.find((value: { id: string }) => value.id === course.nodes.second);
  const path = course.apiPath(`/nodes/${node.id}`);
  const descriptions = async () =>
    (
      await (await recipient.get(`/api/notifications?nodeId=${node.id}`)).json()
    ).notifications.filter(
      (notice: { data: { noticeTarget: string } }) =>
        notice.data.noticeTarget === 'node-description',
    );
  expect(
    (
      await author.patch(path, {
        data: { description: 'Descripción publicada durante el bloqueo' },
      })
    ).status(),
  ).toBe(200);
  expect(await descriptions()).toHaveLength(0);
  expect(
    (await recipient.post(course.apiPath(`/nodes/${course.nodes.first}/completion`))).status(),
  ).toBe(200);
  const accessible = await (await recipient.get(course.apiPath())).json();
  expect(accessible.nodes.find((value: { id: string }) => value.id === node.id).description).toBe(
    'Descripción publicada durante el bloqueo',
  );
  expect((await author.patch(path, { data: { description: node.description } })).status()).toBe(
    200,
  );
  await expect.poll(descriptions).toHaveLength(1);
  expect((await descriptions())[0].data.knownValue).toBe(
    '"Descripción publicada durante el bloqueo"',
  );
});
