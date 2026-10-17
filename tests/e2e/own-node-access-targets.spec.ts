import type { APIRequestContext } from '@playwright/test';
import { expect, test } from './fixtures';
import { createDependency, prepareNodeCreator } from './create-node';
import { createExistingNode } from './existing-node';
import { sql } from './database';
import { ok } from './helpers';
import { acknowledgeOpening, findNode, listNotices, prepareOpening, recognize } from './notices';
import { changeTeacherBlock, hideNode } from './previewed-writes';

test('a Teacher block cascade reconciles one access target per changed Node for each student', async ({
  course,
  apiAs,
  teacherApi: author,
  studentApi: pending,
}) => {
  const complete = await apiAs(course.users.studentWithProgress);
  const { nodeTypeId } = await prepareNodeCreator(author, course);
  const ids: string[] = [];
  for (let index = 0; index < 6; index++) {
    ids.push(
      await createExistingNode({
        roadmapId: course.roadmapId,
        nodeTypeId,
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
  const notices = (api: APIRequestContext) =>
    listNotices(api, { roadmapId: course.roadmapId, limit: 100 });
  await ok(await changeTeacherBlock(author, course.apiPath(`/nodes/${ids[0]}`)));
  await expect.poll(() => notices(complete)).toHaveLength(6);
  await expect.poll(() => notices(pending)).toHaveLength(1);
  for (const notice of await notices(complete)) {
    expect(notice.data).toMatchObject({
      noticeTarget: 'node-access',
      knownValue: 'Disponible',
      currentValue: 'Bloqueado',
    });
  }
  await ok(await changeTeacherBlock(author, course.apiPath(`/nodes/${ids[0]}`), 'BRANCH_UNLOCK'));
  await expect.poll(() => notices(complete)).toHaveLength(0);
  await expect.poll(() => notices(pending)).toHaveLength(0);
});

test('hide → show → block collapses to one access notice and recognition rebases later changes', async ({
  course,
  teacherApi: author,
  studentApi: recipient,
}) => {
  const nodeId = course.nodes.first;
  const path = course.apiPath(`/nodes/${nodeId}`);
  const notices = () => listNotices(recipient, { nodeId, limit: 100 });
  await ok(await hideNode(author, path));
  await expect
    .poll(async () => (await notices())[0]?.data)
    .toMatchObject({ knownValue: 'Disponible', currentValue: 'Retirado' });
  await ok(await author.patch(path, { data: { isVisible: true } }));
  await expect.poll(notices).toHaveLength(0);
  await ok(await changeTeacherBlock(author, path));
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0]).toMatchObject({
    body: expect.stringContaining('fue bloqueado.'),
    data: { noticeTarget: 'node-access', knownValue: 'Disponible', currentValue: 'Bloqueado' },
  });
  const opening = await prepareOpening(recipient, course.roadmapId);
  await ok(await hideNode(author, path));
  await expect.poll(async () => (await notices())[0]?.data.currentValue).toBe('Retirado');
  await acknowledgeOpening(recipient, opening);
  await expect
    .poll(async () => (await notices())[0]?.data)
    .toMatchObject({ knownValue: 'Bloqueado', currentValue: 'Retirado' });
  await acknowledgeOpening(recipient, opening);
  expect(await notices()).toHaveLength(1);
  const title = (await notices())[0].subject;
  const next = await prepareOpening(recipient, course.roadmapId);
  const recognized = await ok(
    await recipient.post('/api/notifications/acknowledge', { data: next }),
  );
  expect((await recognized.json()).summary.groups).toContainEqual({
    title: title,
    items: [`«${title}» fue ocultado del Roadmap.`],
  });
  await expect.poll(notices).toHaveLength(0);
});

test('a student Completion advances known access before a later Teacher block', async ({
  course,
  teacherApi: author,
  studentApi: student,
}) => {
  const unchanged = course.nodes.first;
  // Capture access knowledge during an unrelated teaching visibility edit.
  await ok(
    await author.patch(course.apiPath(`/nodes/${unchanged}`), { data: { isVisible: true } }),
  );
  await ok(await student.post(course.apiPath(`/nodes/${unchanged}/completion`)));
  const nodeId = course.nodes.second;
  const roadmap = await (await student.get(course.apiPath())).json();
  expect(findNode(roadmap, nodeId).access).toMatchObject({ status: 'ACCESSIBLE' });
  await ok(await changeTeacherBlock(author, course.apiPath(`/nodes/${nodeId}`)));
  const notices = () => listNotices(student, { nodeId });
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0].data).toMatchObject({
    knownValue: 'Disponible',
    currentValue: 'Bloqueado',
  });
});

test('Completion withdraws returned access and preserves a genuinely pending publication target', async ({
  course,
  teacherApi: author,
  studentApi: student,
}) => {
  const { nodeTypeId } = await prepareNodeCreator(author, course);
  const prerequisite = course.nodes.first;
  const dependent = await createExistingNode({
    roadmapId: course.roadmapId,
    nodeTypeId,
    title: 'Completación y acceso',
  });
  const notices = () => listNotices(student, { nodeId: dependent });
  await createDependency(author, course, prerequisite, dependent);
  await expect
    .poll(async () => (await notices())[0]?.data)
    .toMatchObject({ knownValue: 'Disponible', currentValue: 'Bloqueado' });
  await ok(await student.post(course.apiPath(`/nodes/${prerequisite}/completion`)));
  await expect.poll(notices).toHaveLength(0);
  const hidden = await createExistingNode({
    roadmapId: course.roadmapId,
    nodeTypeId,
    title: 'Publicación pendiente',
  });
  await ok(await hideNode(author, course.apiPath(`/nodes/${hidden}`)));
  const hiddenNotices = () => listNotices(student, { nodeId: hidden });
  await expect.poll(hiddenNotices).toHaveLength(1);
  await recognize(student, course.roadmapId);
  await ok(await author.patch(course.apiPath(`/nodes/${hidden}`), { data: { isVisible: true } }));
  await createDependency(author, course, course.nodes.second, hidden);
  await expect
    .poll(async () => (await hiddenNotices())[0]?.data)
    .toMatchObject({ knownValue: 'Retirado', currentValue: 'Bloqueado' });
  // Completion must preserve the publication's last-known Retirado baseline.
  await ok(await student.post(course.apiPath(`/nodes/${course.nodes.second}/completion`)));
  await expect
    .poll(async () => (await hiddenNotices())[0]?.data)
    .toMatchObject({ knownValue: 'Retirado', currentValue: 'Disponible' });
  expect(await notices()).toHaveLength(0);
});
