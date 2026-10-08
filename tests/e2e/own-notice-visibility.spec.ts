import { expect, test } from './fixtures';
import { sql } from './database';
import { createExistingNode } from './existing-node';

test('blocking hides a pending description from Inbox and counts; unblocking restores the same notice', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const path = course.apiPath(`/nodes/${course.nodes.first}`);
  const notices = async () =>
    (await (await recipient.get(`/api/notifications?nodeId=${course.nodes.first}`)).json())
      .notifications;
  expect(
    (await author.patch(path, { data: { description: 'Descripción pendiente' } })).status(),
  ).toBe(200);
  await expect.poll(notices).toHaveLength(1);
  const noticeId = (await notices())[0].id;
  expect((await author.post(`${path}/teacher-block`)).status()).toBe(200);
  await expect
    .poll(async () =>
      (await notices()).map(
        (notice: { data: { noticeTarget: string } }) => notice.data.noticeTarget,
      ),
    )
    .toEqual(['node-access']);
  const count = await (
    await recipient.get(`/api/notifications/node-changes?roadmapId=${course.roadmapId}`)
  ).json();
  expect(count.byNode[course.nodes.first]).toBe(1);
  expect(
    (await (await recipient.get(`/api/notifications/counts?roadmapId=${course.roadmapId}`)).json())
      .count,
  ).toBe(1);
  const preview = await (await author.get(`${path}/teacher-block?operation=UNBLOCK`)).json();
  expect(
    (
      await author.delete(`${path}/teacher-block`, {
        headers: { 'x-teacher-block-preview': preview.version },
      })
    ).status(),
  ).toBe(200);
  await expect
    .poll(async () => (await notices()).map((notice: { id: string }) => notice.id))
    .toEqual([noticeId]);
});

test('Participation loss withdraws pending notices permanently, isolated to that recipient and Roadmap', async ({
  course,
  apiAs,
  createCourse,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const otherRecipient = await apiAs(course.users.studentWithProgress);
  const otherCourse = await createCourse({
    participants: [
      { user: course.users.teacher, role: 'TEACHER' },
      { user: course.users.studentWithoutProgress, role: 'STUDENT' },
    ],
  });
  const edit = async (path: string) =>
    expect((await author.patch(path, { data: { title: 'Título pendiente' } })).status()).toBe(200);
  const otherRoadmap = await (await author.get(otherCourse.apiPath())).json();
  await edit(course.apiPath(`/nodes/${course.nodes.first}`));
  await edit(
    otherCourse.apiPath(
      `/nodes/${otherRoadmap.nodes.find((node: { isVisible: boolean }) => node.isVisible).id}`,
    ),
  );
  const notices = async (api = recipient, roadmapId = course.roadmapId) =>
    (await (await api.get(`/api/notifications?roadmapId=${roadmapId}`)).json()).notifications;
  await expect.poll(() => notices()).toHaveLength(1);
  await expect.poll(() => notices(recipient, otherCourse.roadmapId!)).toHaveLength(1);
  await expect.poll(() => notices(otherRecipient)).toHaveLength(1);
  const opening = { roadmapId: course.roadmapId, operationId: crypto.randomUUID() };
  expect((await recipient.post('/api/notifications/openings', { data: opening })).status()).toBe(
    200,
  );
  await sql(
    `UPDATE "Participation" SET "isActive" = false WHERE "courseOfferingId" = '${course.id}' AND "userId" = '${course.users.studentWithoutProgress.id}';`,
  );
  expect(await notices()).toHaveLength(0);
  expect((await recipient.get(course.apiPath())).status()).toBe(403);
  await sql(
    `UPDATE "Participation" SET "isActive" = true WHERE "courseOfferingId" = '${course.id}' AND "userId" = '${course.users.studentWithoutProgress.id}';`,
  );
  expect(await notices()).toHaveLength(0);
  expect((await recipient.post('/api/notifications/acknowledge', { data: opening })).status()).toBe(
    404,
  );
  expect(await notices(otherRecipient)).toHaveLength(1);
  expect(await notices(recipient, otherCourse.roadmapId!)).toHaveLength(1);
  expect(
    (
      await author.patch(course.apiPath(`/nodes/${course.nodes.first}`), {
        data: { title: 'Cambio posterior al regreso' },
      })
    ).status(),
  ).toBe(200);
  await expect.poll(() => notices()).toHaveLength(1);
});

test('hidden Node content returns on showing, but entry recognizes hidden targets without listing them', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const recognize = async () => {
    const opening = { roadmapId: course.roadmapId, operationId: crypto.randomUUID() };
    expect((await recipient.post('/api/notifications/openings', { data: opening })).status()).toBe(
      200,
    );
    const response = await recipient.post('/api/notifications/acknowledge', { data: opening });
    expect(response.status()).toBe(200);
    return response.json();
  };
  const initial = await (await author.get(course.apiPath())).json();
  const nodeId = await createExistingNode({
    roadmapId: course.roadmapId,
    nodeTypeId: initial.nodeTypes[0].id,
    title: 'Nodo conocido',
  });
  await recognize();
  const path = course.apiPath(`/nodes/${nodeId}`);
  const roadmap = await (await author.get(course.apiPath())).json();
  const node = roadmap.nodes.find((value: { id: string }) => value.id === nodeId);
  const type = roadmap.nodeTypes.find((value: { id: string }) => value.id !== node.nodeTypeId);
  expect(
    (
      await author.patch(path, {
        data: {
          title: 'Título pendiente',
          description: 'Descripción pendiente',
          nodeTypeId: type.id,
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await author.post(`${path}/resources`, {
        data: { title: 'Guía pendiente', url: 'https://example.test/guide', type: 'LINK' },
      })
    ).status(),
  ).toBe(201);
  const notices = async () =>
    (await (await recipient.get(`/api/notifications?nodeId=${nodeId}`)).json()).notifications;
  await expect.poll(notices).toHaveLength(4);
  const ids = (await notices()).map((notice: { id: string }) => notice.id).sort();
  expect((await author.patch(path, { data: { isVisible: false } })).status()).toBe(200);
  await expect
    .poll(async () =>
      (await notices()).map(
        (notice: { data: { noticeTarget: string } }) => notice.data.noticeTarget,
      ),
    )
    .toEqual(['node-access']);
  expect((await recipient.get(`/api/notifications/${ids[0]}`)).status()).toBe(404);
  expect((await author.patch(path, { data: { isVisible: true } })).status()).toBe(200);
  await expect
    .poll(async () => (await notices()).map((notice: { id: string }) => notice.id).sort())
    .toEqual(ids);
  expect((await author.patch(path, { data: { isVisible: false } })).status()).toBe(200);
  await expect.poll(async () => (await notices())[0]?.data.currentValue).toBe('Retirado');
  const recognized = await recognize();
  expect(recognized.acknowledged).toBe(5);
  expect(recognized.summary.groups).toEqual([
    { title: 'Título pendiente', items: ['«Título pendiente» fue ocultado del Roadmap.'] },
  ]);
  expect(await notices()).toHaveLength(0);
  expect((await author.patch(path, { data: { isVisible: true } })).status()).toBe(200);
  await expect
    .poll(async () =>
      (await notices()).map(
        (notice: { data: { noticeTarget: string } }) => notice.data.noticeTarget,
      ),
    )
    .toEqual(['node-access']);
  expect((await recognize()).summary.groups).toEqual([
    { title: 'Título pendiente', items: ['«Título pendiente» volvió a mostrarse en el Roadmap.'] },
  ]);
});

test('concurrent Roadmap openings cannot retain withdrawn targets after Participation loss', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  expect(
    (
      await author.patch(course.apiPath(`/nodes/${course.nodes.first}`), {
        data: { title: 'Cambio antes de perder acceso' },
      })
    ).status(),
  ).toBe(200);
  const notices = async () =>
    (await (await recipient.get(`/api/notifications?roadmapId=${course.roadmapId}`)).json())
      .notifications;
  await expect.poll(notices).toHaveLength(1);
  const openings = Array.from({ length: 8 }, () => ({
    roadmapId: course.roadmapId,
    operationId: crypto.randomUUID(),
  }));
  const [responses] = await Promise.all([
    Promise.all(
      openings.map((opening) => recipient.post('/api/notifications/openings', { data: opening })),
    ),
    sql(
      `UPDATE "Participation" SET "isActive" = false WHERE "courseOfferingId" = '${course.id}' AND "userId" = '${course.users.studentWithoutProgress.id}';`,
    ),
  ]);
  for (const response of responses) expect([200, 403]).toContain(response.status());
  await sql(
    `UPDATE "Participation" SET "isActive" = true WHERE "courseOfferingId" = '${course.id}' AND "userId" = '${course.users.studentWithoutProgress.id}';`,
  );
  for (const opening of openings)
    expect(
      (await recipient.post('/api/notifications/acknowledge', { data: opening })).status(),
    ).toBe(404);
  expect(await notices()).toHaveLength(0);
});
