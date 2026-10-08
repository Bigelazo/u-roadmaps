import { expect, test } from './fixtures';
import { createExistingNode } from './existing-node';
import { sql } from './database';

test('a Teacher block cascade reconciles one access target per changed Node for each student', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const complete = await apiAs(course.users.studentWithProgress);
  const pending = await apiAs(course.users.studentWithoutProgress);
  const roadmap = await (await author.get(course.apiPath())).json();
  const ids: string[] = [];
  for (let index = 0; index < 6; index++) {
    ids.push(
      await createExistingNode({
        roadmapId: course.roadmapId,
        nodeTypeId: roadmap.nodeTypes[0].id,
        title: `Acceso ${index}`,
      }),
    );
  }
  await sql(
    ids
      .slice(1)
      .map(
        (id, index) =>
          `INSERT INTO "Dependency" ("id", "sourceNodeId", "targetNodeId") VALUES ('${crypto.randomUUID()}', '${ids[index]}', '${id}');`,
      )
      .join('\n') +
      ids
        .map(
          (id) =>
            `INSERT INTO "Completion" ("id", "userId", "roadmapNodeId") VALUES ('${crypto.randomUUID()}', '${course.users.studentWithProgress.id}', '${id}');`,
        )
        .join('\n'),
  );
  const notices = async (api: typeof complete) =>
    (await (await api.get(`/api/notifications?roadmapId=${course.roadmapId}&limit=100`)).json())
      .notifications;
  expect((await author.post(course.apiPath(`/nodes/${ids[0]}/teacher-block`))).status()).toBe(200);
  await expect.poll(() => notices(complete)).toHaveLength(6);
  await expect.poll(() => notices(pending)).toHaveLength(1);
  for (const notice of await notices(complete)) {
    expect(notice.data).toMatchObject({
      noticeTarget: 'node-access',
      knownValue: 'Disponible',
      currentValue: 'Bloqueado',
    });
  }
  const preview = await (
    await author.get(course.apiPath(`/nodes/${ids[0]}/teacher-block?operation=BRANCH_UNLOCK`))
  ).json();
  expect(
    (
      await author.patch(course.apiPath(`/nodes/${ids[0]}/teacher-block`), {
        headers: { 'x-teacher-block-preview': preview.version },
      })
    ).status(),
  ).toBe(200);
  await expect.poll(() => notices(complete)).toHaveLength(0);
  await expect.poll(() => notices(pending)).toHaveLength(0);
});

test('hide → show → block collapses to one access notice and recognition rebases later changes', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const nodeId = course.nodes.first;
  const path = course.apiPath(`/nodes/${nodeId}`);
  const notices = async () =>
    (await (await recipient.get(`/api/notifications?nodeId=${nodeId}&limit=100`)).json())
      .notifications;
  expect((await author.patch(path, { data: { isVisible: false } })).status()).toBe(200);
  await expect
    .poll(async () => (await notices())[0]?.data)
    .toMatchObject({ knownValue: 'Disponible', currentValue: 'Retirado' });
  expect((await author.patch(path, { data: { isVisible: true } })).status()).toBe(200);
  await expect.poll(notices).toHaveLength(0);
  expect((await author.post(`${path}/teacher-block`)).status()).toBe(200);
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0]).toMatchObject({
    body: expect.stringContaining('fue bloqueado.'),
    data: { noticeTarget: 'node-access', knownValue: 'Disponible', currentValue: 'Bloqueado' },
  });
  const opening = { roadmapId: course.roadmapId, operationId: crypto.randomUUID() };
  expect((await recipient.post('/api/notifications/openings', { data: opening })).status()).toBe(
    200,
  );
  expect((await author.patch(path, { data: { isVisible: false } })).status()).toBe(200);
  await expect.poll(async () => (await notices())[0]?.data.currentValue).toBe('Retirado');
  expect((await recipient.post('/api/notifications/acknowledge', { data: opening })).status()).toBe(
    200,
  );
  await expect
    .poll(async () => (await notices())[0]?.data)
    .toMatchObject({ knownValue: 'Bloqueado', currentValue: 'Retirado' });
  expect((await recipient.post('/api/notifications/acknowledge', { data: opening })).status()).toBe(
    200,
  );
  expect(await notices()).toHaveLength(1);
  const title = (await notices())[0].subject;
  const next = { roadmapId: course.roadmapId, operationId: crypto.randomUUID() };
  expect((await recipient.post('/api/notifications/openings', { data: next })).status()).toBe(200);
  const recognized = await recipient.post('/api/notifications/acknowledge', { data: next });
  expect(recognized.status()).toBe(200);
  expect((await recognized.json()).summary.groups).toContainEqual({
    title: title,
    items: [`«${title}» fue ocultado del Roadmap.`],
  });
  await expect.poll(notices).toHaveLength(0);
});

test('a student Completion advances known access before a later Teacher block', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const student = await apiAs(course.users.studentWithoutProgress);
  const unchanged = course.nodes.first;
  // Capture access knowledge during an unrelated teaching visibility edit.
  expect(
    (
      await author.patch(course.apiPath(`/nodes/${unchanged}`), { data: { isVisible: true } })
    ).status(),
  ).toBe(200);
  expect((await student.post(course.apiPath(`/nodes/${unchanged}/completion`))).status()).toBe(200);
  const nodeId = course.nodes.second;
  const nodes = (await (await student.get(course.apiPath())).json()).nodes;
  expect(nodes.find((node: { id: string }) => node.id === nodeId).access).toMatchObject({
    status: 'ACCESSIBLE',
  });
  expect((await author.post(course.apiPath(`/nodes/${nodeId}/teacher-block`))).status()).toBe(200);
  const notices = async () =>
    (await (await student.get(`/api/notifications?nodeId=${nodeId}`)).json()).notifications;
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0].data).toMatchObject({
    knownValue: 'Disponible',
    currentValue: 'Bloqueado',
  });
});

test('Completion withdraws returned access and preserves a genuinely pending publication target', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const student = await apiAs(course.users.studentWithoutProgress);
  const roadmap = await (await author.get(course.apiPath())).json();
  const prerequisite = course.nodes.first;
  const dependent = await createExistingNode({
    roadmapId: course.roadmapId,
    nodeTypeId: roadmap.nodeTypes[0].id,
    title: 'Completación y acceso',
  });
  const notices = async () =>
    (await (await student.get(`/api/notifications?nodeId=${dependent}`)).json()).notifications;
  expect(
    (
      await author.post(course.apiPath('/dependencies'), {
        data: { sourceNodeId: prerequisite, targetNodeId: dependent },
      })
    ).status(),
  ).toBe(201);
  await expect
    .poll(async () => (await notices())[0]?.data)
    .toMatchObject({ knownValue: 'Disponible', currentValue: 'Bloqueado' });
  expect((await student.post(course.apiPath(`/nodes/${prerequisite}/completion`))).status()).toBe(
    200,
  );
  await expect.poll(notices).toHaveLength(0);
  const hidden = await createExistingNode({
    roadmapId: course.roadmapId,
    nodeTypeId: roadmap.nodeTypes[0].id,
    title: 'Publicación pendiente',
  });
  expect(
    (
      await author.patch(course.apiPath(`/nodes/${hidden}`), { data: { isVisible: false } })
    ).status(),
  ).toBe(200);
  const opening = { roadmapId: course.roadmapId, operationId: crypto.randomUUID() };
  const hiddenNotices = async () =>
    (await (await student.get(`/api/notifications?nodeId=${hidden}`)).json()).notifications;
  await expect.poll(hiddenNotices).toHaveLength(1);
  expect((await student.post('/api/notifications/openings', { data: opening })).status()).toBe(200);
  expect((await student.post('/api/notifications/acknowledge', { data: opening })).status()).toBe(
    200,
  );
  expect(
    (
      await author.patch(course.apiPath(`/nodes/${hidden}`), { data: { isVisible: true } })
    ).status(),
  ).toBe(200);
  expect(
    (
      await author.post(course.apiPath('/dependencies'), {
        data: { sourceNodeId: course.nodes.second, targetNodeId: hidden },
      })
    ).status(),
  ).toBe(201);
  await expect
    .poll(async () => (await hiddenNotices())[0]?.data)
    .toMatchObject({ knownValue: 'Retirado', currentValue: 'Bloqueado' });
  // Completion must preserve the publication's last-known Retirado baseline.
  expect(
    (await student.post(course.apiPath(`/nodes/${course.nodes.second}/completion`))).status(),
  ).toBe(200);
  await expect
    .poll(async () => (await hiddenNotices())[0]?.data)
    .toMatchObject({ knownValue: 'Retirado', currentValue: 'Disponible' });
  expect(await notices()).toHaveLength(0);
});
