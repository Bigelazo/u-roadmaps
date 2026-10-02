import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { developmentFixtureIds } from '@/development';
import { expect, test } from '@playwright/test';
import { authenticateAs, fixture, roadmapPath, sessionCookie } from './helpers';

type StoredNotice = Readonly<{
  id: string;
  subject: string;
  body: string;
  read: boolean;
  data: Record<string, unknown>;
}>;

function fixtureSql(sql: string) {
  const connection = process.env.E2E_DATABASE_URL ?? parse(readFileSync('.env')).E2E_DATABASE_URL;
  if (!connection || new URL(connection).pathname !== '/roadmap_e2e_db')
    throw new Error('Expected the E2E database.');
  const url = new URL(connection);
  execFileSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    stdio: 'pipe',
    timeout: 15_000,
    env: {
      ...process.env,
      PGDATABASE: 'roadmap_e2e_db',
      PGHOST: url.hostname,
      PGPORT: url.port || '5432',
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
    },
  });
}

function cleanupNotices(nodeIds: readonly string[]) {
  for (const id of nodeIds)
    fixtureSql(`DELETE FROM "RoadmapNotice" WHERE "data"->>'nodeId' = '${id}';`);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('access notices retain context and follow each Participation access transition', async ({
  request,
  page,
}) => {
  const author = { cookie: await sessionCookie(fixture.daniela) };
  const studentWithoutProgress = fixture.cc1002StudentWithoutProgress;
  const studentWithProgress = fixture.cc1002StudentWithProgress;
  const inactiveStudent = fixture.cc1002WithdrawnStudent;
  const roadmap = await (await request.get(roadmapPath(), { headers: author })).json();
  const nodeIds: string[] = [];
  let dependencyId: string | undefined;

  const createNode = async (title: string) => {
    const response = await request.post(roadmapPath('/nodes'), {
      headers: author,
      data: {
        title,
        description: `Detalle privado ${crypto.randomUUID()}`,
        nodeTypeId: roadmap.nodeTypes[0].id,
        positionX: 600 + nodeIds.length * 400,
        positionY: 0,
      },
    });
    expect(response.status()).toBe(201);
    const id = (await response.json()).node.id as string;
    nodeIds.push(id);
    return id;
  };

  const noticesFor = async (userId: string, nodeId: string) => {
    const response = await request.get(
      `/api/notifications?roadmapId=${roadmap.roadmap.id}&nodeId=${nodeId}&limit=100`,
      { headers: { cookie: await sessionCookie(userId) } },
    );
    expect(response.status()).toBe(200);
    return (await response.json()).notifications as StoredNotice[];
  };

  const accessNotice = async (userId: string, nodeId: string, changeKind: string) =>
    (await noticesFor(userId, nodeId)).find((notice) => notice.data.changeKind === changeKind);

  const teacherBlockPreview = async (nodeId: string, operation: 'UNBLOCK' | 'BRANCH_UNLOCK') => {
    const response = await request.get(
      roadmapPath(`/nodes/${nodeId}/teacher-block?operation=${operation}`),
      { headers: author },
    );
    expect(response.status()).toBe(200);
    return (await response.json()).version as string;
  };

  const selectNotice = async (userId: string, title: string, body: string) => {
    await authenticateAs(page.context(), userId);
    await page.goto('/academic-overview');
    await page.getByRole('button', { name: /^Avisos(,|$)/ }).click();
    await page
      .getByRole('list', { name: 'Lista de avisos' })
      .getByRole('button', {
        name: new RegExp(`^${escapeRegExp(title)}\\s+${body}`),
      })
      .first()
      .click();
  };

  try {
    const rootTitle = `Acceso inicial ${crypto.randomUUID()}`;
    const dependentTitle = `Acceso dependiente ${crypto.randomUUID()}`;
    const rootId = await createNode(rootTitle);
    const dependentId = await createNode(dependentTitle);

    const dependency = await request.post(roadmapPath('/dependencies'), {
      headers: author,
      data: { sourceNodeId: rootId, targetNodeId: dependentId },
    });
    expect(dependency.status()).toBe(201);
    dependencyId = (await dependency.json()).dependency.id as string;
    expect(
      (
        await request.post(roadmapPath(`/nodes/${rootId}/completion`), {
          headers: { cookie: await sessionCookie(studentWithProgress) },
        })
      ).status(),
    ).toBe(200);
    cleanupNotices([rootId, dependentId]);

    expect(
      (
        await request.post(roadmapPath(`/nodes/${rootId}/teacher-block`), { headers: author })
      ).status(),
    ).toBe(200);

    const blockedRoot = await accessNotice(studentWithoutProgress, rootId, 'node-blocked');
    expect(blockedRoot).toMatchObject({
      subject: rootTitle,
      data: { targetKind: 'roadmap', nodeId: rootId, nodeTitle: rootTitle },
    });
    expect(await accessNotice(studentWithoutProgress, dependentId, 'node-blocked')).toBeUndefined();
    expect(await accessNotice(studentWithProgress, dependentId, 'node-blocked')).toMatchObject({
      data: { targetKind: 'roadmap', nodeTitle: dependentTitle },
    });
    expect(await noticesFor(fixture.daniela, rootId)).toHaveLength(0);
    expect(await noticesFor(inactiveStudent, rootId)).toHaveLength(0);
    expect(JSON.stringify(blockedRoot)).not.toContain('Detalle privado');

    const directUnlockVersion = await teacherBlockPreview(rootId, 'UNBLOCK');
    expect(
      (
        await request.delete(roadmapPath(`/nodes/${rootId}/teacher-block`), {
          headers: { ...author, 'x-teacher-block-preview': directUnlockVersion },
        })
      ).status(),
    ).toBe(200);
    expect(await accessNotice(studentWithoutProgress, rootId, 'node-available')).toMatchObject({
      data: { targetKind: 'node', nodeTitle: rootTitle },
    });
    expect(
      await accessNotice(studentWithoutProgress, dependentId, 'node-available'),
    ).toBeUndefined();

    const branchUnlockVersion = await teacherBlockPreview(rootId, 'BRANCH_UNLOCK');
    expect(
      (
        await request.patch(roadmapPath(`/nodes/${rootId}/teacher-block`), {
          headers: { ...author, 'x-teacher-block-preview': branchUnlockVersion },
        })
      ).status(),
    ).toBe(200);
    const dependentAvailable = await accessNotice(
      studentWithProgress,
      dependentId,
      'node-available',
    );
    expect(dependentAvailable).toMatchObject({
      subject: dependentTitle,
      data: { targetKind: 'node', nodeTitle: dependentTitle },
    });
    expect(
      await accessNotice(studentWithoutProgress, dependentId, 'node-available'),
    ).toBeUndefined();

    expect(
      (
        await request.post(roadmapPath(`/nodes/${dependentId}/teacher-block`), { headers: author })
      ).status(),
    ).toBe(200);
    await selectNotice(studentWithProgress, dependentTitle, 'Nodo disponible:');
    await expect(page.getByRole('dialog', { name: dependentTitle, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cerrar detalle' })).toHaveCount(0);
    await expect
      .poll(async () =>
        (await noticesFor(studentWithProgress, dependentId)).filter(({ read }) => !read),
      )
      .toHaveLength(0);

    // Hiding a visible Node keeps its old title and recognizes it from the Roadmap.
    expect(
      (
        await request.patch(roadmapPath(`/nodes/${rootId}`), {
          headers: author,
          data: { isVisible: false },
        })
      ).status(),
    ).toBe(200);
    const retired = await accessNotice(studentWithoutProgress, rootId, 'node-retired');
    expect(retired).toMatchObject({
      subject: rootTitle,
      data: { targetKind: 'roadmap', nodeId: rootId, nodeTitle: rootTitle },
    });
    await selectNotice(studentWithoutProgress, rootTitle, 'Nodo retirado:');
    await expect(page.getByRole('dialog', { name: rootTitle, exact: true })).toBeVisible();
    await expect(page).not.toHaveURL(/targetNode=/);
    await expect
      .poll(async () =>
        (await noticesFor(studentWithoutProgress, rootId)).filter(({ read }) => !read),
      )
      .toHaveLength(0);

    // A visible but blocked Node remains notifiable when deletion cascades over its related data.
    const sourceId = await createNode(`Origen ${crypto.randomUUID()}`);
    const removedTitle = `Eliminación bloqueada ${crypto.randomUUID()}`;
    const removedId = await createNode(removedTitle);
    expect(
      (
        await request.post(roadmapPath(`/nodes/${sourceId}/completion`), {
          headers: { cookie: await sessionCookie(studentWithProgress) },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post(roadmapPath(`/nodes/${removedId}/completion`), {
          headers: { cookie: await sessionCookie(studentWithProgress) },
        })
      ).status(),
    ).toBe(200);
    const removalDependency = await request.post(roadmapPath('/dependencies'), {
      headers: author,
      data: { sourceNodeId: sourceId, targetNodeId: removedId },
    });
    expect(removalDependency.status()).toBe(201);
    const removalDependencyId = (await removalDependency.json()).dependency.id as string;
    fixtureSql(
      `DELETE FROM "RoadmapNotice" WHERE "data"->>'nodeId' = '${removedId}' AND "data"->>'changeKind' IN ('node-available', 'node-blocked');`,
    );
    const resource = await request.post(roadmapPath(`/nodes/${removedId}/resources`), {
      headers: author,
      data: {
        title: `Material previo ${crypto.randomUUID()}`,
        url: 'https://example.test/access-notice-resource',
        type: 'LINK',
      },
    });
    expect(resource.status()).toBe(201);
    expect(
      (
        await request.post(roadmapPath(`/nodes/${removedId}/teacher-block`), { headers: author })
      ).status(),
    ).toBe(200);
    const beforeDelete = await noticesFor(studentWithProgress, removedId);
    expect(beforeDelete.map(({ data }) => data.changeKind)).toEqual([
      'node-blocked',
      'resource-added',
    ]);

    expect(
      (await request.delete(roadmapPath(`/nodes/${removedId}`), { headers: author })).status(),
    ).toBe(204);
    nodeIds.splice(nodeIds.indexOf(removedId), 1);
    const deletionNotices = await noticesFor(studentWithProgress, removedId);
    expect(deletionNotices.map(({ data }) => data.changeKind)).toEqual([
      'node-deleted',
      'node-blocked',
      'resource-added',
    ]);
    expect(deletionNotices[0]).toMatchObject({
      subject: removedTitle,
      data: { targetKind: 'roadmap', nodeId: removedId, nodeTitle: removedTitle },
    });
    expect(deletionNotices.some(({ data }) => data.changeKind === 'resource-removed')).toBe(false);
    expect(
      (await noticesFor(studentWithoutProgress, removedId)).some(
        ({ data }) => data.changeKind === 'node-deleted',
      ),
    ).toBe(true);
    expect(await noticesFor(inactiveStudent, removedId)).toHaveLength(0);
    expect(await noticesFor(fixture.daniela, removedId)).toHaveLength(0);

    await selectNotice(studentWithoutProgress, removedTitle, 'Nodo eliminado:');
    await expect(page.getByRole('dialog', { name: removedTitle, exact: true })).toBeVisible();
    await expect(page).not.toHaveURL(/targetNode=/);
    await expect
      .poll(async () =>
        (await noticesFor(studentWithoutProgress, removedId)).filter(({ read }) => !read),
      )
      .toHaveLength(0);
    await request.delete(roadmapPath(`/dependencies/${removalDependencyId}`), { headers: author });
  } finally {
    if (dependencyId)
      await request.delete(roadmapPath(`/dependencies/${dependencyId}`), { headers: author });
    for (const nodeId of [...nodeIds].reverse())
      await request.delete(roadmapPath(`/nodes/${nodeId}`), { headers: author });
    cleanupNotices(nodeIds);
  }
});

test('lost Course access retains saved notices and acknowledges only the selected one', async ({
  request,
  page,
}) => {
  const author = { cookie: await sessionCookie(fixture.daniela) };
  const userId = crypto.randomUUID();
  const roadmap = await (await request.get(roadmapPath(), { headers: author })).json();
  const nodeIds: string[] = [];
  const createNode = async (title: string) => {
    const response = await request.post(roadmapPath('/nodes'), {
      headers: author,
      data: {
        title,
        nodeTypeId: roadmap.nodeTypes[0].id,
        positionX: 600 + nodeIds.length * 400,
        positionY: 0,
      },
    });
    expect(response.status()).toBe(201);
    const id = (await response.json()).node.id as string;
    nodeIds.push(id);
    return id;
  };
  const allNotices = async () => {
    const response = await request.get(
      `/api/notifications?courseCode=CC1002&year=2026&semester=2&limit=100`,
      { headers: { cookie: await sessionCookie(userId) } },
    );
    expect(response.status()).toBe(200);
    return (await response.json()).notifications as StoredNotice[];
  };

  try {
    fixtureSql(
      `INSERT INTO "User" ("id", "name", "institutionalEmail") VALUES ('${userId}', 'Participación revocada', '${userId}@u-roadmaps.test'); INSERT INTO "Participation" ("id", "userId", "courseOfferingId", "role", "isActive") VALUES ('${crypto.randomUUID()}', '${userId}', '${developmentFixtureIds.offerings.cc1002}', 'STUDENT', true);`,
    );
    const firstTitle = `Aviso conservado A ${crypto.randomUUID()}`;
    const secondTitle = `Aviso conservado B ${crypto.randomUUID()}`;
    const firstId = await createNode(firstTitle);
    const secondId = await createNode(secondTitle);
    expect((await allNotices()).map(({ subject }) => subject)).toEqual([secondTitle, firstTitle]);

    fixtureSql(
      `UPDATE "Participation" SET "isActive" = false WHERE "userId" = '${userId}' AND "courseOfferingId" = '${developmentFixtureIds.offerings.cc1002}';`,
    );
    await createNode(`Aviso posterior ${crypto.randomUUID()}`);
    const retained = await allNotices();
    expect(retained).toHaveLength(2);
    expect(retained.find(({ subject }) => subject === firstTitle)).toMatchObject({
      data: { nodeId: firstId, targetKind: 'node' },
    });
    expect(retained.find(({ subject }) => subject === secondTitle)).toMatchObject({
      data: { nodeId: secondId, targetKind: 'node' },
    });

    await authenticateAs(page.context(), userId);
    await page.goto('/academic-overview');
    await page.getByRole('button', { name: /^Avisos(,|$)/ }).click();
    await page
      .getByRole('list', { name: 'Lista de avisos' })
      .getByRole('button', { name: new RegExp(escapeRegExp(firstTitle)) })
      .click();
    await expect(page).toHaveURL(/\/academic-overview\?.*noticeFallback=course-unavailable/);
    await expect(
      page.getByRole('status').filter({ hasText: 'No se puede abrir este Roadmap' }),
    ).toContainText('Tu Participación ya no tiene acceso a este Curso.');
    await expect
      .poll(async () => (await allNotices()).find(({ subject }) => subject === firstTitle)?.read)
      .toBe(true);
    expect((await allNotices()).find(({ subject }) => subject === secondTitle)?.read).toBe(false);
  } finally {
    for (const nodeId of [...nodeIds].reverse())
      await request.delete(roadmapPath(`/nodes/${nodeId}`), { headers: author });
    cleanupNotices(nodeIds);
    fixtureSql(`DELETE FROM "User" WHERE "id" = '${userId}';`);
  }
});
