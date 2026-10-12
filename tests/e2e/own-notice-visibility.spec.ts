import { expect, test } from './fixtures';
import { prepareNodeCreator } from './create-node';
import { sql } from './database';
import { createExistingNode } from './existing-node';
import { ok } from './helpers';
import { findNode, listNotices, prepareOpening } from './notices';

test('blocking hides a pending description from Inbox and counts; unblocking restores the same notice', async ({
  course,
  teacherApi: author,
  studentApi: recipient,
}) => {
  const path = course.apiPath(`/nodes/${course.nodes.first}`);
  const notices = () => listNotices(recipient, { nodeId: course.nodes.first });
  await ok(await author.patch(path, { data: { description: 'Descripción pendiente' } }));
  await expect.poll(notices).toHaveLength(1);
  const noticeId = (await notices())[0].id;
  await ok(await author.post(`${path}/teacher-block`));
  await expect
    .poll(async () => (await notices()).map((notice) => notice.data.noticeTarget))
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
  await ok(
    await author.delete(`${path}/teacher-block`, {
      headers: { 'x-teacher-block-preview': preview.version },
    }),
  );
  await expect.poll(async () => (await notices()).map((notice) => notice.id)).toEqual([noticeId]);
});

test('Participation loss withdraws pending notices permanently, isolated to that recipient and Roadmap', async ({
  course,
  apiAs,
  teacherApi: author,
  studentApi: recipient,
  createCourse,
}) => {
  const otherRecipient = await apiAs(course.users.studentWithProgress);
  const otherCourse = await createCourse({
    participants: [
      { user: course.users.teacher, role: 'TEACHER' },
      { user: course.users.studentWithoutProgress, role: 'STUDENT' },
    ],
  });
  const edit = async (path: string) =>
    ok(await author.patch(path, { data: { title: 'Título pendiente' } }));
  const otherRoadmap = await (await author.get(otherCourse.apiPath())).json();
  await edit(course.apiPath(`/nodes/${course.nodes.first}`));
  await edit(
    otherCourse.apiPath(
      `/nodes/${otherRoadmap.nodes.find((node: { isVisible: boolean }) => node.isVisible).id}`,
    ),
  );
  const notices = (api = recipient, roadmapId = course.roadmapId) =>
    listNotices(api, { roadmapId });
  await expect.poll(() => notices()).toHaveLength(1);
  await expect.poll(() => notices(recipient, otherCourse.roadmapId!)).toHaveLength(1);
  await expect.poll(() => notices(otherRecipient)).toHaveLength(1);
  const opening = await prepareOpening(recipient, course.roadmapId);
  await sql(
    `UPDATE "Participation" SET "isActive" = false WHERE "courseOfferingId" = '${course.id}' AND "userId" = '${course.users.studentWithoutProgress.id}';`,
  );
  expect(await notices()).toHaveLength(0);
  await ok(await recipient.get(course.apiPath()), 403);
  await sql(
    `UPDATE "Participation" SET "isActive" = true WHERE "courseOfferingId" = '${course.id}' AND "userId" = '${course.users.studentWithoutProgress.id}';`,
  );
  expect(await notices()).toHaveLength(0);
  await ok(await recipient.post('/api/notifications/acknowledge', { data: opening }), 404);
  expect(await notices(otherRecipient)).toHaveLength(1);
  expect(await notices(recipient, otherCourse.roadmapId!)).toHaveLength(1);
  await ok(
    await author.patch(course.apiPath(`/nodes/${course.nodes.first}`), {
      data: { title: 'Cambio posterior al regreso' },
    }),
  );
  await expect.poll(() => notices()).toHaveLength(1);
});

test('hidden Node content returns on showing, but entry recognizes hidden targets without listing them', async ({
  course,
  teacherApi: author,
  studentApi: recipient,
}) => {
  // Returns the acknowledgement body, which carries the recognition summary.
  const recognize = async () => {
    const opening = await prepareOpening(recipient, course.roadmapId);
    const response = await ok(
      await recipient.post('/api/notifications/acknowledge', { data: opening }),
    );
    return response.json();
  };
  const { nodeTypeId } = await prepareNodeCreator(author, course);
  const nodeId = await createExistingNode({
    roadmapId: course.roadmapId,
    nodeTypeId,
    title: 'Nodo conocido',
  });
  await recognize();
  const path = course.apiPath(`/nodes/${nodeId}`);
  const roadmap = await (await author.get(course.apiPath())).json();
  const node = findNode(roadmap, nodeId);
  const type = roadmap.nodeTypes.find((value: { id: string }) => value.id !== node.nodeTypeId);
  await ok(
    await author.patch(path, {
      data: {
        title: 'Título pendiente',
        description: 'Descripción pendiente',
        nodeTypeId: type.id,
      },
    }),
  );
  await ok(
    await author.post(`${path}/resources`, {
      data: { title: 'Guía pendiente', url: 'https://example.test/guide', type: 'LINK' },
    }),
    201,
  );
  const notices = () => listNotices(recipient, { nodeId });
  const targets = async () => (await notices()).map((notice) => notice.data.noticeTarget);
  await expect.poll(notices).toHaveLength(4);
  const ids = (await notices()).map((notice) => notice.id).sort();
  await ok(await author.patch(path, { data: { isVisible: false } }));
  await expect.poll(targets).toEqual(['node-access']);
  await ok(await recipient.get(`/api/notifications/${ids[0]}`), 404);
  await ok(await author.patch(path, { data: { isVisible: true } }));
  await expect.poll(async () => (await notices()).map((notice) => notice.id).sort()).toEqual(ids);
  await ok(await author.patch(path, { data: { isVisible: false } }));
  await expect.poll(async () => (await notices())[0]?.data.currentValue).toBe('Retirado');
  const recognized = await recognize();
  expect(recognized.acknowledged).toBe(5);
  expect(recognized.summary.groups).toEqual([
    { title: 'Título pendiente', items: ['«Título pendiente» fue ocultado del Roadmap.'] },
  ]);
  expect(await notices()).toHaveLength(0);
  await ok(await author.patch(path, { data: { isVisible: true } }));
  await expect.poll(targets).toEqual(['node-access']);
  expect((await recognize()).summary.groups).toEqual([
    { title: 'Título pendiente', items: ['«Título pendiente» volvió a mostrarse en el Roadmap.'] },
  ]);
});

test('concurrent Roadmap openings cannot retain withdrawn targets after Participation loss', async ({
  course,
  teacherApi: author,
  studentApi: recipient,
}) => {
  await ok(
    await author.patch(course.apiPath(`/nodes/${course.nodes.first}`), {
      data: { title: 'Cambio antes de perder acceso' },
    }),
  );
  const notices = () => listNotices(recipient, { roadmapId: course.roadmapId });
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
    await ok(await recipient.post('/api/notifications/acknowledge', { data: opening }), 404);
  expect(await notices()).toHaveLength(0);
});
