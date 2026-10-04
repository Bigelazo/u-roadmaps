import { literal, sql } from './database';
import { expect, test } from './fixtures';
import { createExistingNode } from './existing-node';
import { sessionCookie, authenticateAs } from './helpers';

type StoredNotice = Readonly<{
  id: string;
  subject: string;
  body: string;
  read: boolean;
  data: Record<string, unknown>;
}>;

async function cleanupNodeNotices(nodeIds: readonly string[]) {
  for (const id of nodeIds)
    await sql(`DELETE FROM "RoadmapNotice" WHERE "data"->>'nodeId' = '${id}';`);
}

async function cleanupDependencyNotices(dependencyIds: readonly string[]) {
  for (const id of dependencyIds)
    await sql(`DELETE FROM "RoadmapNotice" WHERE "data"->>'dependencyId' = '${id}';`);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('Dependency notices preserve route and access changes with separate recognition', async ({
  request,
  course,
  page,
}) => {
  test.setTimeout(90_000);
  const roadmapPath = course.apiPath;
  const author = { cookie: await sessionCookie(course.users.teacher.id) };
  const studentWithoutPrerequisite = course.users.studentWithoutProgress.id;
  const studentWithPrerequisites = course.users.studentWithProgress.id;
  const inactiveStudent = course.users.withdrawnStudent.id;
  const roadmap = await (await request.get(roadmapPath(), { headers: author })).json();
  const roadmapId = roadmap.roadmap.id as string;
  const nodeIds: string[] = [];
  const dependencyIds: string[] = [];
  const paginationEventPrefix = `e2e-route-pagination-${crypto.randomUUID()}`;

  const createNode = async (title: string) => {
    // Existing Nodes start with no delivery window; this journey tests the
    // Dependency's access transition rather than Node creation.
    const id = await createExistingNode({
      roadmapId: roadmap.roadmap.id,
      nodeTypeId: roadmap.nodeTypes[0].id,
      title,
      positionX: 800 + nodeIds.length * 320,
    });
    nodeIds.push(id);
    return id;
  };

  const createDependency = async (sourceNodeId: string, targetNodeId: string) => {
    const response = await request.post(roadmapPath('/dependencies'), {
      headers: author,
      data: { sourceNodeId, targetNodeId },
    });
    expect(response.status()).toBe(201);
    const id = (await response.json()).dependency.id as string;
    dependencyIds.push(id);
    return id;
  };

  const noticesFor = async (userId: string) => {
    const response = await request.get(`/api/notifications?roadmapId=${roadmapId}&limit=100`, {
      headers: { cookie: await sessionCookie(userId) },
    });
    expect(response.status()).toBe(200);
    return (await response.json()).notifications as StoredNotice[];
  };

  const routeNoticesFor = async (userId: string, dependencyId: string) =>
    (await noticesFor(userId)).filter(({ data }) => data.dependencyId === dependencyId);

  const nodeNoticesFor = async (userId: string, nodeId: string) => {
    const response = await request.get(
      `/api/notifications?roadmapId=${roadmapId}&nodeId=${nodeId}&limit=100`,
      { headers: { cookie: await sessionCookie(userId) } },
    );
    expect(response.status()).toBe(200);
    return (await response.json()).notifications as StoredNotice[];
  };

  const selectRouteNotice = async (userId: string, notice: StoredNotice) => {
    await authenticateAs(page.context(), userId);
    await page.goto('/academic-overview');
    await page.getByRole('button', { name: /^Avisos(,|$)/ }).click();
    const noticeButton = page.getByRole('list', { name: 'Lista de avisos' }).getByRole('button', {
      name: new RegExp(`^${escapeRegExp(notice.subject)}\\s+${escapeRegExp(notice.body)}`),
    });
    const rows = page.getByRole('list', { name: 'Lista de avisos' }).getByRole('listitem');
    await expect(rows.first()).toBeVisible();
    while ((await noticeButton.count()) === 0) {
      const previousCount = await rows.count();
      await page.getByRole('button', { name: 'Cargar más avisos' }).click();
      await expect.poll(() => rows.count()).toBeGreaterThan(previousCount);
    }
    await noticeButton.click();
  };

  try {
    const prerequisiteTitle = `Prerrequisito ${crypto.randomUUID()}`;
    const dependentTitle = `Nodo dependiente ${crypto.randomUUID()}`;
    const transitiveTitle = `Dependiente transitivo ${crypto.randomUUID()}`;
    const prerequisiteId = await createNode(prerequisiteTitle);
    const dependentId = await createNode(dependentTitle);
    const transitiveId = await createNode(transitiveTitle);
    await cleanupNodeNotices(nodeIds);

    for (const nodeId of [dependentId]) {
      const completed = await request.post(roadmapPath(`/nodes/${nodeId}/completion`), {
        headers: { cookie: await sessionCookie(studentWithoutPrerequisite) },
      });
      expect(completed.status()).toBe(200);
    }
    for (const nodeId of [prerequisiteId, dependentId]) {
      const completed = await request.post(roadmapPath(`/nodes/${nodeId}/completion`), {
        headers: { cookie: await sessionCookie(studentWithPrerequisites) },
      });
      expect(completed.status()).toBe(200);
    }

    // Establish a transitive branch while every student's access is unchanged.
    const branchDependencyId = crypto.randomUUID();
    await sql(
      `INSERT INTO "Dependency" ("id", "sourceNodeId", "targetNodeId") VALUES ('${branchDependencyId}', '${dependentId}', '${transitiveId}');`,
    );
    dependencyIds.push(branchDependencyId);
    await cleanupNodeNotices(nodeIds);

    const dependencyId = await createDependency(prerequisiteId, dependentId);
    const duplicate = await request.post(roadmapPath('/dependencies'), {
      headers: author,
      data: { sourceNodeId: prerequisiteId, targetNodeId: dependentId },
    });
    expect(duplicate.status()).toBe(409);

    await expect
      .poll(async () => routeNoticesFor(studentWithoutPrerequisite, dependencyId))
      .toMatchObject([
        {
          subject: 'Ruta actualizada',
          body: expect.stringContaining(
            `«${dependentTitle}» ahora requiere «${prerequisiteTitle}»`,
          ),
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
    expect(await routeNoticesFor(course.users.teacher.id, dependencyId)).toHaveLength(0);
    expect(await routeNoticesFor(inactiveStudent, dependencyId)).toHaveLength(0);

    const blockedForStudent = async (userId: string) =>
      Promise.all(
        [dependentId, transitiveId].map(async (nodeId) =>
          (await nodeNoticesFor(userId, nodeId))
            .filter(({ data }) => data.changeKind === 'node-blocked')
            .map(({ data }) => data.nodeId),
        ),
      );
    await expect
      .poll(() => blockedForStudent(studentWithoutPrerequisite))
      .toEqual([[dependentId], [transitiveId]]);
    expect(await blockedForStudent(studentWithPrerequisites)).toEqual([[], []]);
    expect(await blockedForStudent(inactiveStudent)).toEqual([[], []]);

    const roadmapCount = await request.get(`/api/notifications/counts?roadmapId=${roadmapId}`, {
      headers: { cookie: await sessionCookie(studentWithoutPrerequisite) },
    });
    expect((await roadmapCount.json()).count).toBeGreaterThan(0);

    const addedRouteNotice = (await routeNoticesFor(studentWithoutPrerequisite, dependencyId))[0];
    await selectRouteNotice(studentWithoutPrerequisite, addedRouteNotice);
    await expect(page).toHaveURL(new RegExp(`${course.pagePath()}\\?notice=`));
    await expect(page).not.toHaveURL(/targetNode=/);
    const addedDialog = page.getByRole('dialog', { name: 'Ruta actualizada' });
    await expect(addedDialog).toBeVisible();
    await expect(addedDialog).toContainText(
      `«${dependentTitle}» ahora requiere «${prerequisiteTitle}»`,
    );
    await expect
      .poll(async () => (await routeNoticesFor(studentWithoutPrerequisite, dependencyId))[0]?.read)
      .toBe(true);
    for (const nodeId of [dependentId, transitiveId])
      await expect
        .poll(
          async () =>
            (await nodeNoticesFor(studentWithoutPrerequisite, nodeId)).find(
              ({ data }) => data.changeKind === 'node-blocked',
            )?.read,
        )
        .toBe(true);
    await page.getByRole('button', { name: 'Entendido' }).click();

    const removal = await request.delete(roadmapPath(`/dependencies/${dependencyId}`), {
      headers: author,
    });
    expect(removal.status()).toBe(204);
    await expect
      .poll(async () => routeNoticesFor(studentWithoutPrerequisite, dependencyId), {
        timeout: 70_000,
        intervals: [1000],
      })
      .toHaveLength(2);
    for (const nodeId of [dependentId, transitiveId])
      await expect
        .poll(
          async () =>
            (await nodeNoticesFor(studentWithoutPrerequisite, nodeId)).filter(
              ({ data }) => data.changeKind === 'node-available',
            ),
          { timeout: 70_000, intervals: [1000] },
        )
        .toHaveLength(1);

    const removedRouteNotice = (
      await routeNoticesFor(studentWithoutPrerequisite, dependencyId)
    ).find(({ data }) => data.changeKind === 'dependency-removed');
    expect(removedRouteNotice).toBeDefined();
    // Newly delivered summaries can move an older route notice to another page.
    // Make pagination deterministic instead of depending on earlier test timing.
    for (let index = 0; index < 12; index++)
      await sql(
        `INSERT INTO "RoadmapNotice" ("id", "eventId", "recipientId", "roadmapId", "courseOfferingId", "subject", "body", "data", "occurredAt") VALUES ('${crypto.randomUUID()}', '${paginationEventPrefix}-${index}', '${studentWithoutPrerequisite}', '${roadmapId}', (SELECT "courseOfferingId" FROM "Roadmap" WHERE "id" = '${roadmapId}'), 'Aviso de página ${index}', 'Cambio general', '{"roadmapId":"${roadmapId}","courseCode":"${course.courseCode}","year":2026,"semester":2,"targetKind":"roadmap"}', NOW());`,
      );
    await selectRouteNotice(studentWithoutPrerequisite, removedRouteNotice!);
    await expect(page).toHaveURL(new RegExp(`${course.pagePath()}\\?notice=`));
    await expect(
      page.getByRole('dialog', { name: new RegExp(`Resumen de cambios.*${course.courseCode}`) }),
    ).toContainText(`«${dependentTitle}» ya no requiere «${prerequisiteTitle}»`);
    await expect
      .poll(
        async () =>
          (await routeNoticesFor(studentWithoutPrerequisite, dependencyId)).find(
            ({ data }) => data.changeKind === 'dependency-removed',
          )?.read,
      )
      .toBe(true);
    for (const nodeId of [dependentId, transitiveId])
      expect(
        (await nodeNoticesFor(studentWithoutPrerequisite, nodeId)).find(
          ({ data }) => data.changeKind === 'node-available',
        )?.read,
      ).toBe(false);

    await page.getByRole('button', { name: 'Entendido' }).click();
    const dependentNode = page.locator(`.react-flow__node[data-id="${dependentId}"]`);
    await expect(dependentNode).toBeVisible();
    await dependentNode.click();
    await expect(page.getByRole('button', { name: 'Cerrar detalle' })).toBeVisible();
    await expect
      .poll(
        async () =>
          (await nodeNoticesFor(studentWithoutPrerequisite, dependentId)).find(
            ({ data }) => data.changeKind === 'node-available',
          )?.read,
      )
      .toBe(true);
    expect(
      (await nodeNoticesFor(studentWithoutPrerequisite, transitiveId)).find(
        ({ data }) => data.changeKind === 'node-available',
      )?.read,
    ).toBe(false);
  } finally {
    await sql(`DELETE FROM "RoadmapNotice" WHERE "eventId" LIKE '${paginationEventPrefix}-%';`);
    for (const dependencyId of [...dependencyIds].reverse())
      await request.delete(roadmapPath(`/dependencies/${dependencyId}`), { headers: author });
    for (const nodeId of [...nodeIds].reverse())
      await request.delete(roadmapPath(`/nodes/${nodeId}`), { headers: author });
    await cleanupNodeNotices(nodeIds);
    await cleanupDependencyNotices(dependencyIds);
  }
});

test('cascade Dependency removals from Node visibility and deletion do not create route notices', async ({
  request,
  course,
}) => {
  const roadmapPath = course.apiPath;
  const author = { cookie: await sessionCookie(course.users.teacher.id) };
  const student = course.users.studentWithoutProgress.id;
  const roadmap = await (await request.get(roadmapPath(), { headers: author })).json();
  const nodeIds: string[] = [];
  const dependencyIds: string[] = [];
  const createNode = async (title: string) => {
    const response = await request.post(roadmapPath('/nodes'), {
      headers: author,
      data: {
        title,
        nodeTypeId: roadmap.nodeTypes[0].id,
        positionX: 2400 + nodeIds.length * 320,
        positionY: 0,
      },
    });
    expect(response.status()).toBe(201);
    const id = (await response.json()).node.id as string;
    nodeIds.push(id);
    return id;
  };
  const createDependency = async (sourceNodeId: string, targetNodeId: string) => {
    // Prepare an existing edge without opening a delivery window: this case
    // tests cascade removal, while explicit edits are covered above.
    const id = crypto.randomUUID();
    await sql(
      `INSERT INTO "Dependency" ("id", "sourceNodeId", "targetNodeId") VALUES (${literal(id)}, ${literal(sourceNodeId)}, ${literal(targetNodeId)});`,
    );
    dependencyIds.push(id);
    return id;
  };
  const routeNotices = async (dependencyId: string) => {
    const response = await request.get(
      `/api/notifications?roadmapId=${roadmap.roadmap.id}&limit=100`,
      { headers: { cookie: await sessionCookie(student) } },
    );
    return ((await response.json()).notifications as StoredNotice[]).filter(
      ({ data }) => data.dependencyId === dependencyId,
    );
  };

  try {
    const hiddenSource = await createNode(`Ocultamiento origen ${crypto.randomUUID()}`);
    const hiddenTarget = await createNode(`Ocultamiento destino ${crypto.randomUUID()}`);
    const hiddenDependency = await createDependency(hiddenSource, hiddenTarget);
    const hidden = await request.patch(roadmapPath(`/nodes/${hiddenTarget}`), {
      headers: author,
      data: { isVisible: false },
    });
    expect(hidden.status()).toBe(200);
    expect(await routeNotices(hiddenDependency)).toHaveLength(0);

    const deleteSource = await createNode(`Eliminación origen ${crypto.randomUUID()}`);
    const deleteTarget = await createNode(`Eliminación destino ${crypto.randomUUID()}`);
    const deleteDependency = await createDependency(deleteSource, deleteTarget);
    expect(
      (await request.delete(roadmapPath(`/nodes/${deleteTarget}`), { headers: author })).status(),
    ).toBe(204);
    expect(await routeNotices(deleteDependency)).toHaveLength(0);
    nodeIds.splice(nodeIds.indexOf(deleteTarget), 1);
  } finally {
    for (const dependencyId of [...dependencyIds].reverse())
      await request.delete(roadmapPath(`/dependencies/${dependencyId}`), { headers: author });
    for (const nodeId of [...nodeIds].reverse())
      await request.delete(roadmapPath(`/nodes/${nodeId}`), { headers: author });
    await cleanupNodeNotices(nodeIds);
    await cleanupDependencyNotices(dependencyIds);
  }
});

test('a PostgreSQL route-notice failure preserves the confirmed Dependency mutation', async ({
  request,
  course,
  rejectNoticeInserts,
}) => {
  test.setTimeout(95_000);
  const roadmapPath = course.apiPath;
  const author = { cookie: await sessionCookie(course.users.teacher.id) };
  const student = course.users.studentWithoutProgress.id;
  const roadmap = await (await request.get(roadmapPath(), { headers: author })).json();
  const nodeIds: string[] = [];
  let dependencyId: string | undefined;
  const dependentTitle = `Fallo de aviso de ruta ${crypto.randomUUID()}`;

  const createNode = async (title: string) => {
    // Existing Nodes start with no delivery window; this journey tests the
    // Dependency's access transition rather than Node creation.
    const id = await createExistingNode({
      roadmapId: roadmap.roadmap.id,
      nodeTypeId: roadmap.nodeTypes[0].id,
      title,
      positionX: 800 + nodeIds.length * 320,
    });
    nodeIds.push(id);
    return id;
  };

  const noticesFor = async (nodeId?: string) => {
    const response = await request.get(
      `/api/notifications?roadmapId=${roadmap.roadmap.id}${nodeId ? `&nodeId=${nodeId}` : ''}&limit=100`,
      { headers: { cookie: await sessionCookie(student) } },
    );
    expect(response.status()).toBe(200);
    return (await response.json()).notifications as StoredNotice[];
  };

  try {
    const prerequisiteId = await createNode(`Fallo de prerrequisito ${crypto.randomUUID()}`);
    const dependentId = await createNode(dependentTitle);
    await cleanupNodeNotices(nodeIds);
    const failure = await rejectNoticeInserts({
      roadmapId: course.roadmapId,
      noticeClass: 'roadmap-path-changed',
    });

    const response = await request.post(roadmapPath('/dependencies'), {
      headers: author,
      data: { sourceNodeId: prerequisiteId, targetNodeId: dependentId },
    });
    expect(response.status()).toBe(201);
    dependencyId = (await response.json()).dependency.id as string;

    const persisted = await request.get(roadmapPath(), { headers: author });
    expect(persisted.status()).toBe(200);
    expect((await persisted.json()).dependencies).toContainEqual(
      expect.objectContaining({ sourceNodeId: prerequisiteId, targetNodeId: dependentId }),
    );
    expect(await failure.wasAttempted()).toBe(true);
    expect((await noticesFor()).some(({ data }) => data.dependencyId === dependencyId)).toBe(false);
    await expect
      .poll(async () =>
        (await noticesFor(dependentId)).some(({ data }) => data.changeKind === 'node-blocked'),
      )
      .toBe(true);
  } finally {
    if (dependencyId)
      await request.delete(roadmapPath(`/dependencies/${dependencyId}`), { headers: author });
    for (const nodeId of [...nodeIds].reverse())
      await request.delete(roadmapPath(`/nodes/${nodeId}`), { headers: author });
    await cleanupNodeNotices(nodeIds);
    if (dependencyId) await cleanupDependencyNotices([dependencyId]);
  }
});
