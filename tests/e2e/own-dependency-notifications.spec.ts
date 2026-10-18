import { enterRoadmap } from './enter-roadmap';
import { insert, literal, sql } from './database';
import { expect, test, type E2EUser } from './fixtures';
import { createDependency, prepareNodeCreator } from './create-node';
import { createExistingNode } from './existing-node';
import { authenticateAs, escapeRegExp, ok } from './helpers';
import { listNotices, type StoredNotice } from './notices';
import { deleteNode, hideNode } from './previewed-writes';

test('Dependency notices preserve route and access changes with Roadmap entry recognition', async ({
  course,
  apiAs,
  teacherApi,
  page,
}) => {
  const roadmapPath = course.apiPath;
  const author = teacherApi;
  const studentWithoutPrerequisite = course.users.studentWithoutProgress;
  await enterRoadmap(page, course.pagePath(), studentWithoutPrerequisite.id);
  await page.goto('/academic-overview');
  const studentWithPrerequisites = course.users.studentWithProgress;
  const inactiveStudent = course.users.withdrawnStudent;
  const { nodeTypeId } = await prepareNodeCreator(author, course);
  const roadmapId = course.roadmapId;
  const nodeIds: string[] = [];

  const createNode = async (title: string) => {
    // Existing Nodes start with no delivery window; this journey tests the
    // Dependency's access transition rather than Node creation.
    const id = await createExistingNode({
      roadmapId,
      nodeTypeId,
      title,
      positionX: 800 + nodeIds.length * 320,
    });
    nodeIds.push(id);
    return id;
  };

  const noticesFor = async (user: E2EUser) =>
    listNotices(await apiAs(user), { roadmapId, limit: 100 });

  const routeNoticesFor = async (user: E2EUser, dependencyId: string) =>
    (await noticesFor(user)).filter(({ data }) => data.dependencyId === dependencyId);

  const nodeNoticesFor = async (user: E2EUser, nodeId: string) =>
    listNotices(await apiAs(user), { roadmapId, nodeId, limit: 100 });

  const selectRouteNotice = async (user: E2EUser, notice: StoredNotice) => {
    await authenticateAs(page.context(), user.id);
    await page.goto('/academic-overview');
    await page.getByRole('button', { name: /^Avisos(,|$)/ }).click();
    const noticeButton = page.getByRole('list', { name: 'Lista de avisos' }).getByRole('button', {
      name: new RegExp(
        `^${escapeRegExp(course.courseName)}\\s+(El Roadmap ha recibido \\d+ cambios\\.|${escapeRegExp(notice.body)})`,
      ),
    });
    await expect(noticeButton).toBeVisible();
    await noticeButton.click();
  };

  const prerequisiteTitle = `Prerrequisito ${crypto.randomUUID()}`;
  const dependentTitle = `Nodo dependiente ${crypto.randomUUID()}`;
  const transitiveTitle = `Dependiente transitivo ${crypto.randomUUID()}`;
  const prerequisiteId = await createNode(prerequisiteTitle);
  const dependentId = await createNode(dependentTitle);
  const transitiveId = await createNode(transitiveTitle);

  // Progress is scenario preparation, before the Dependency changes access.
  // Seed it with the owned fixture data instead of competing Serializable
  // completion transactions while other workers prepare their Courses.
  await sql(
    insert('Completion', [
      {
        id: crypto.randomUUID(),
        userId: studentWithoutPrerequisite.id,
        roadmapNodeId: dependentId,
      },
      {
        id: crypto.randomUUID(),
        userId: studentWithPrerequisites.id,
        roadmapNodeId: prerequisiteId,
      },
      { id: crypto.randomUUID(), userId: studentWithPrerequisites.id, roadmapNodeId: dependentId },
    ]),
  );

  // Establish a transitive branch while every student's access is unchanged.
  const branchDependencyId = crypto.randomUUID();
  await sql(
    `INSERT INTO "Dependency" ("id", "sourceNodeId", "targetNodeId") VALUES ('${branchDependencyId}', '${dependentId}', '${transitiveId}');`,
  );

  const dependencyId = await createDependency(author, course, prerequisiteId, dependentId);
  const duplicate = await ok(
    await author.post(roadmapPath('/dependencies'), {
      data: { sourceNodeId: prerequisiteId, targetNodeId: dependentId },
    }),
    409,
  );
  expect((await duplicate.json()).error.code).toBe('DEPENDENCY_CONFLICT');

  await expect
    .poll(async () => routeNoticesFor(studentWithoutPrerequisite, dependencyId))
    .toMatchObject([
      {
        subject: 'Ruta actualizada',
        body: expect.stringContaining(`«${dependentTitle}» ahora requiere «${prerequisiteTitle}»`),
        read: false,
        data: {
          targetKind: 'roadmap',
          changeKind: 'dependency-added',
          dependencyId,
          dependentNodeTitle: dependentTitle,
          prerequisiteNodeTitle: prerequisiteTitle,
        },
      },
    ]);
  await expect
    .poll(async () => routeNoticesFor(studentWithPrerequisites, dependencyId))
    .toHaveLength(1);
  expect(await routeNoticesFor(course.users.teacher, dependencyId)).toHaveLength(0);
  expect(await routeNoticesFor(inactiveStudent, dependencyId)).toHaveLength(0);

  const blockedForStudent = async (user: E2EUser) =>
    Promise.all(
      [dependentId, transitiveId].map(async (nodeId) =>
        (await nodeNoticesFor(user, nodeId))
          .filter(({ data }) => data.changeKind === 'node-blocked')
          .map(({ data }) => data.nodeId),
      ),
    );
  await expect
    .poll(() => blockedForStudent(studentWithoutPrerequisite))
    .toEqual([[dependentId], [transitiveId]]);
  expect(await blockedForStudent(studentWithPrerequisites)).toEqual([[], []]);
  expect(await blockedForStudent(inactiveStudent)).toEqual([[], []]);

  const roadmapCount = await (
    await apiAs(studentWithoutPrerequisite)
  ).get(`/api/notifications/counts?roadmapId=${roadmapId}`);
  expect((await roadmapCount.json()).count).toBeGreaterThan(0);

  const addedRouteNotice = (await routeNoticesFor(studentWithoutPrerequisite, dependencyId))[0];
  await selectRouteNotice(studentWithoutPrerequisite, addedRouteNotice);
  await expect(page).toHaveURL(course.pagePath());
  await expect(page).not.toHaveURL(/targetNode=/);
  const addedDialog = page.getByRole('dialog', {
    name: `Cambios en el Roadmap de ${course.courseCode}`,
  });
  await expect(addedDialog).toBeVisible();
  await expect(addedDialog).toContainText(
    `«${dependentTitle}» ahora requiere «${prerequisiteTitle}»`,
  );
  await expect.poll(() => noticesFor(studentWithoutPrerequisite)).toHaveLength(0);
  await page.getByRole('button', { name: 'Entendido' }).click();

  await ok(await author.delete(roadmapPath(`/dependencies/${dependencyId}`)), 204);
  await expect
    .poll(async () => routeNoticesFor(studentWithoutPrerequisite, dependencyId))
    .toHaveLength(1);
  for (const nodeId of [dependentId, transitiveId])
    await expect
      .poll(async () =>
        (await nodeNoticesFor(studentWithoutPrerequisite, nodeId)).filter(
          ({ data }) => data.changeKind === 'node-available',
        ),
      )
      .toHaveLength(1);

  const removedRouteNotice = (await routeNoticesFor(studentWithoutPrerequisite, dependencyId)).find(
    ({ data }) => data.changeKind === 'dependency-removed',
  );
  expect(removedRouteNotice).toBeDefined();
  // Newly delivered notices can move an older route notice to another page.
  // Make pagination deterministic instead of depending on earlier test timing.
  // Historical rows were already shown: scrolling them into view must not
  // generate seen signals that refresh and disable the pagination button mid-click.
  for (let index = 0; index < 12; index++)
    await sql(
      `INSERT INTO "RoadmapNotice" ("id", "eventId", "recipientId", "roadmapId", "courseOfferingId", "subject", "body", "data", "occurredAt") VALUES ('${crypto.randomUUID()}', '${crypto.randomUUID()}', '${studentWithoutPrerequisite.id}', '${roadmapId}', (SELECT "courseOfferingId" FROM "Roadmap" WHERE "id" = '${roadmapId}'), 'Aviso de página ${index}', 'Cambio general', '{"roadmapId":"${roadmapId}","courseCode":"${course.courseCode}","year":2026,"semester":2,"targetKind":"roadmap"}', NOW());`,
    );
  await selectRouteNotice(studentWithoutPrerequisite, removedRouteNotice!);
  await expect(page).toHaveURL(course.pagePath());
  await expect(
    // Repeats are now stored immediately (no grouping window, see ADR-0014).
    page.getByRole('dialog', { name: `Cambios en el Roadmap de ${course.courseCode}` }),
  ).toContainText(`«${dependentTitle}» ya no requiere «${prerequisiteTitle}»`);
  await expect.poll(() => noticesFor(studentWithoutPrerequisite)).toHaveLength(0);
  await page.getByRole('button', { name: 'Entendido' }).click();
  const dependentNode = page.locator(`.react-flow__node[data-id="${dependentId}"]`);
  await dependentNode.click();
  await expect(page.getByRole('button', { name: 'Cerrar detalle' })).toBeVisible();
  expect(await noticesFor(studentWithoutPrerequisite)).toHaveLength(0);
});

test('cascade Dependency removals from Node visibility and deletion do not create route notices', async ({
  course,
  teacherApi,
  studentApi,
}) => {
  const roadmapPath = course.apiPath;
  const author = teacherApi;
  const creator = await prepareNodeCreator(author, course);
  const nodeIds: string[] = [];
  const createNode = async (title: string) => {
    const { id } = await creator.createNode(title, 2400 + nodeIds.length * 320);
    nodeIds.push(id);
    return id;
  };
  const insertDependency = async (sourceNodeId: string, targetNodeId: string) => {
    // Prepare an existing edge without opening a delivery window: this case
    // tests cascade removal, while explicit edits are covered above.
    const id = crypto.randomUUID();
    await sql(
      `INSERT INTO "Dependency" ("id", "sourceNodeId", "targetNodeId") VALUES (${literal(id)}, ${literal(sourceNodeId)}, ${literal(targetNodeId)});`,
    );
    return id;
  };
  const routeNotices = async (dependencyId: string) =>
    (await listNotices(studentApi, { roadmapId: course.roadmapId, limit: 100 })).filter(
      ({ data }) => data.dependencyId === dependencyId,
    );

  const hiddenSource = await createNode(`Ocultamiento origen ${crypto.randomUUID()}`);
  const hiddenTarget = await createNode(`Ocultamiento destino ${crypto.randomUUID()}`);
  const hiddenDependency = await insertDependency(hiddenSource, hiddenTarget);
  await ok(await hideNode(author, roadmapPath(`/nodes/${hiddenTarget}`)));
  expect(await routeNotices(hiddenDependency)).toHaveLength(0);

  const deleteSource = await createNode(`Eliminación origen ${crypto.randomUUID()}`);
  const deleteTarget = await createNode(`Eliminación destino ${crypto.randomUUID()}`);
  const deleteDependency = await insertDependency(deleteSource, deleteTarget);
  await ok(await deleteNode(author, roadmapPath(`/nodes/${deleteTarget}`)), 204);
  expect(await routeNotices(deleteDependency)).toHaveLength(0);
  nodeIds.splice(nodeIds.indexOf(deleteTarget), 1);
});

test('a PostgreSQL route-notice failure preserves the confirmed Dependency mutation', async ({
  course,
  teacherApi,
  studentApi,
  rejectNoticeInserts,
}) => {
  test.setTimeout(95_000);
  const roadmapPath = course.apiPath;
  const author = teacherApi;
  const { nodeTypeId } = await prepareNodeCreator(author, course);
  const nodeIds: string[] = [];
  const dependentTitle = `Fallo de aviso de ruta ${crypto.randomUUID()}`;

  const createNode = async (title: string) => {
    // Existing Nodes start with no delivery window; this journey tests the
    // Dependency's access transition rather than Node creation.
    const id = await createExistingNode({
      roadmapId: course.roadmapId,
      nodeTypeId,
      title,
      positionX: 800 + nodeIds.length * 320,
    });
    nodeIds.push(id);
    return id;
  };

  const noticesFor = (nodeId?: string) =>
    listNotices(studentApi, {
      roadmapId: course.roadmapId,
      ...(nodeId ? { nodeId } : {}),
      limit: 100,
    });

  const prerequisiteId = await createNode(`Fallo de prerrequisito ${crypto.randomUUID()}`);
  const dependentId = await createNode(dependentTitle);
  const failure = await rejectNoticeInserts({
    roadmapId: course.roadmapId,
    noticeClass: 'roadmap-path-changed',
  });

  const dependencyId = await createDependency(author, course, prerequisiteId, dependentId);

  const persisted = await ok(await author.get(roadmapPath()));
  expect((await persisted.json()).dependencies).toContainEqual(
    expect.objectContaining({ sourceNodeId: prerequisiteId, targetNodeId: dependentId }),
  );
  await expect.poll(() => failure.wasAttempted()).toBe(true);
  expect((await noticesFor()).some(({ data }) => data.dependencyId === dependencyId)).toBe(false);
  await expect
    .poll(async () =>
      (await noticesFor(dependentId)).some(({ data }) => data.changeKind === 'node-blocked'),
    )
    .toBe(true);
});
