import { enterRoadmap } from './enter-roadmap';
import { expect, test, type E2EUser } from './fixtures';
import { prepareNodeCreator } from './create-node';
import { sql } from './database';
import { createExistingNode } from './existing-node';
import { authenticateAs, escapeRegExp, ok } from './helpers';
import { listNotices } from './notices';
import { changeTeacherBlock, hideNode } from './previewed-writes';

test('access notices retain context through blocking, unlocking, hiding and deletion', async ({
  course,
  apiAs,
  teacherApi: author,
  page,
}) => {
  const roadmapPath = course.apiPath;
  const student = course.users.studentWithProgress;
  await enterRoadmap(page, course.pagePath(), student.id);
  await page.goto('/academic-overview');
  const withoutProgress = course.users.studentWithoutProgress;
  const { nodeTypeId } = await prepareNodeCreator(author, course);
  // Existing visible Nodes avoid creation notices during these access changes.
  const existingNode = (title: string) =>
    createExistingNode({
      roadmapId: course.roadmapId,
      nodeTypeId,
      title,
      description: 'Detalle privado',
      positionX: 600,
    });
  const noticesFor = async (user: E2EUser, nodeId: string) =>
    listNotices(await apiAs(user), { nodeId, limit: 100 });
  const selectNotice = async (nodeId: string, title: string) => {
    await authenticateAs(page.context(), student.id);
    await page.goto('/academic-overview');
    await page.getByRole('button', { name: /^Avisos(,|$)/ }).click();
    await page
      .getByRole('list', { name: 'Lista de avisos' })
      .getByRole('button', {
        name: new RegExp(
          `^${escapeRegExp(course.courseName)}\\s+(El Roadmap ha recibido \\d+ cambios\\.|.*${escapeRegExp(title)})`,
        ),
      })
      .first()
      .click();
    // Repeats are stored immediately without a summary (no grouping window, see ADR-0014).
    await expect(
      page.getByRole('dialog', { name: `Cambios en el Roadmap de ${course.courseCode}` }),
    ).toBeVisible();
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
    `INSERT INTO "Dependency" ("id", "sourceNodeId", "targetNodeId") VALUES ('${crypto.randomUUID()}', '${rootId}', '${dependentId}'); INSERT INTO "Completion" ("id", "userId", "roadmapNodeId") VALUES ('${crypto.randomUUID()}', '${student.id}', '${rootId}');`,
  );
  await ok(await changeTeacherBlock(author, roadmapPath(`/nodes/${rootId}`)));
  await expect
    .poll(async () => (await noticesFor(withoutProgress, rootId))[0])
    .toMatchObject({
      subject: rootTitle,
      data: { changeKind: 'node-blocked', targetKind: 'roadmap', nodeTitle: rootTitle },
    });
  expect(await noticesFor(withoutProgress, dependentId)).toHaveLength(0);
  await expect
    .poll(async () => (await noticesFor(student, dependentId))[0])
    .toMatchObject({
      data: { changeKind: 'node-blocked', targetKind: 'roadmap' },
    });
  await ok(await changeTeacherBlock(author, roadmapPath(`/nodes/${rootId}`), 'UNBLOCK'));
  await ok(await changeTeacherBlock(author, roadmapPath(`/nodes/${rootId}`), 'BRANCH_UNLOCK'));
  await ok(await changeTeacherBlock(author, roadmapPath(`/nodes/${dependentId}`)));
  await ok(await hideNode(author, roadmapPath(`/nodes/${rootId}`)));

  const removedTitle = `Eliminación bloqueada ${crypto.randomUUID()}`;
  const removedId = await existingNode(removedTitle);
  await ok(
    await author.post(roadmapPath(`/nodes/${removedId}/resources`), {
      data: {
        title: 'Material previo',
        url: 'https://example.test/access-notice-resource',
        type: 'LINK',
      },
    }),
    201,
  );
  await ok(await changeTeacherBlock(author, roadmapPath(`/nodes/${removedId}`)));
  await ok(await author.delete(roadmapPath(`/nodes/${removedId}`)), 204);

  await expect
    .poll(async () => (await noticesFor(student, removedId))[0]?.data.changeKind)
    .toBe('node-deleted');
  await expect
    .poll(async () => (await noticesFor(student, rootId))[0]?.data.changeKind)
    .toBe('node-retired');
  const retired = (await noticesFor(student, rootId))[0];
  expect(retired).toMatchObject({
    subject: rootTitle,
    data: { changeKind: 'node-retired', targetKind: 'roadmap', nodeTitle: rootTitle },
  });
  expect(JSON.stringify(retired)).not.toContain('Detalle privado');
  await expect.poll(() => noticesFor(student, removedId)).toHaveLength(1);
  const deletionNotices = await noticesFor(student, removedId);
  expect(deletionNotices.map(({ data }) => data.changeKind)).toEqual(['node-deleted']);
  expect(deletionNotices[0]).toMatchObject({
    subject: removedTitle,
    data: { eventCount: 1, targetKind: 'roadmap', nodeTitle: removedTitle },
  });
  await expect
    .poll(async () => (await noticesFor(withoutProgress, removedId))[0]?.data.changeKind)
    .toBe('node-deleted');
  expect(await noticesFor(course.users.withdrawnStudent, removedId)).toHaveLength(0);
  expect(await noticesFor(course.users.teacher, removedId)).toHaveLength(0);
  await selectNotice(removedId, removedTitle);
  expect(await noticesFor(student, rootId)).toHaveLength(0);
});

test('a PostgreSQL access-notice failure leaves the Node visibility change committed', async ({
  course,
  teacherApi: author,
  studentApi,
  rejectNoticeInserts,
}) => {
  const roadmapPath = course.apiPath;
  const { nodeTypeId } = await prepareNodeCreator(author, course);
  const nodeId = await createExistingNode({
    roadmapId: course.roadmapId,
    nodeTypeId,
    title: 'Fallo de aviso',
    positionX: 5600,
  });
  const failure = await rejectNoticeInserts({ roadmapId: course.roadmapId });

  const hidden = await ok(await hideNode(author, roadmapPath(`/nodes/${nodeId}`)));
  expect((await hidden.json()).node).toMatchObject({ id: nodeId, isVisible: false });

  const persistedRoadmap = await ok(await author.get(roadmapPath()));
  expect(
    (await persistedRoadmap.json()).nodes.find(({ id }: { id: string }) => id === nodeId),
  ).toMatchObject({ id: nodeId, isVisible: false });
  await expect.poll(() => failure.wasAttempted()).toBe(true);

  expect(await listNotices(studentApi, { roadmapId: course.roadmapId, nodeId })).toHaveLength(0);
});

test('lost Course offering access withdraws pending notices', async ({
  course,
  teacherApi,
  studentApi,
  page,
}) => {
  const userId = course.users.studentWithoutProgress.id;
  const { createNode } = await prepareNodeCreator(teacherApi, course);
  const allNotices = () =>
    listNotices(studentApi, {
      courseCode: course.courseCode,
      year: course.year,
      semester: course.semester,
      limit: 100,
    });

  const firstTitle = `Aviso conservado A ${crypto.randomUUID()}`;
  const secondTitle = `Aviso conservado B ${crypto.randomUUID()}`;
  await createNode(firstTitle, 600);
  await createNode(secondTitle, 1000);
  await expect
    .poll(async () => (await allNotices()).map(({ subject }) => subject))
    .toEqual([`Nuevo Nodo «${secondTitle}»`, `Nuevo Nodo «${firstTitle}»`]);

  await sql(
    `UPDATE "Participation" SET "isActive" = false WHERE "userId" = '${userId}' AND "courseOfferingId" = '${course.id}';`,
  );
  await createNode(`Aviso posterior ${crypto.randomUUID()}`, 1400);
  expect(await allNotices()).toHaveLength(0);

  await authenticateAs(page.context(), userId);
  await page.goto(course.pagePath());
  await expect(page).toHaveURL(/academic-overview/);
  expect(await allNotices()).toHaveLength(0);
});
