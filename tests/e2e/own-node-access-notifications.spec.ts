import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { developmentFixtureIds } from '@/development';
import { expect, test } from '@playwright/test';
import { createExistingNode } from './existing-node';
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
  return execFileSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    encoding: 'utf8',
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

test('access notices and summaries retain context through blocking, unlocking, hiding and deletion', async ({
  request,
  page,
}) => {
  test.setTimeout(90_000);
  const author = { cookie: await sessionCookie(fixture.daniela) };
  const student = fixture.cc1002StudentWithProgress;
  const withoutProgress = fixture.cc1002StudentWithoutProgress;
  const roadmap = await (await request.get(roadmapPath(), { headers: author })).json();
  const nodeIds: string[] = [];
  // Existing visible Nodes are fixtures, so access changes start fresh windows.
  const existingNode = async (title: string) => {
    const id = await createExistingNode({
      roadmapId: roadmap.roadmap.id,
      nodeTypeId: roadmap.nodeTypes[0].id,
      title,
      description: 'Detalle privado',
      positionX: 600,
    });
    nodeIds.push(id);
    return id;
  };
  const noticesFor = async (userId: string, nodeId: string) => {
    const response = await request.get(`/api/notifications?nodeId=${nodeId}&limit=100`, {
      headers: { cookie: await sessionCookie(userId) },
    });
    expect(response.status()).toBe(200);
    return (await response.json()).notifications as StoredNotice[];
  };
  const selectNotice = async (nodeId: string, title: string) => {
    await authenticateAs(page.context(), student);
    await page.goto('/academic-overview');
    await page.getByRole('button', { name: /^Avisos(,|$)/ }).click();
    await page
      .getByRole('list', { name: 'Lista de avisos' })
      .getByRole('button', { name: new RegExp(`^Resumen de cambios.*${escapeRegExp(title)}`) })
      .first()
      .click();
    await expect(
      page.getByRole('dialog', { name: `Resumen de cambios · Nodo «${title}»`, exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Autor del último cambio', { exact: true })).toBeVisible();
    await expect(page.getByText('Último cambio', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cerrar detalle' })).toHaveCount(0);
    await expect(page).not.toHaveURL(/targetNode=/);
    await expect
      .poll(async () => (await noticesFor(student, nodeId)).filter(({ read }) => !read).length)
      .toBe(0);
  };
  try {
    const rootTitle = `Acceso inicial ${crypto.randomUUID()}`;
    const dependentTitle = `Acceso dependiente ${crypto.randomUUID()}`;
    const rootId = await existingNode(rootTitle);
    const dependentId = await existingNode(dependentTitle);
    fixtureSql(
      `INSERT INTO "Dependency" ("id", "sourceNodeId", "targetNodeId") VALUES ('${crypto.randomUUID()}', '${rootId}', '${dependentId}'); INSERT INTO "Completion" ("id", "userId", "roadmapNodeId") VALUES ('${crypto.randomUUID()}', '${student}', '${rootId}');`,
    );
    expect(
      (
        await request.post(roadmapPath(`/nodes/${rootId}/teacher-block`), { headers: author })
      ).status(),
    ).toBe(200);
    expect((await noticesFor(withoutProgress, rootId))[0]).toMatchObject({
      subject: rootTitle,
      data: { changeKind: 'node-blocked', targetKind: 'roadmap', nodeTitle: rootTitle },
    });
    expect(await noticesFor(withoutProgress, dependentId)).toHaveLength(0);
    expect((await noticesFor(student, dependentId))[0]).toMatchObject({
      data: { changeKind: 'node-blocked', targetKind: 'roadmap' },
    });
    const version = async (operation: string) =>
      (
        await (
          await request.get(roadmapPath(`/nodes/${rootId}/teacher-block?operation=${operation}`), {
            headers: author,
          })
        ).json()
      ).version;
    expect(
      (
        await request.delete(roadmapPath(`/nodes/${rootId}/teacher-block`), {
          headers: { ...author, 'x-teacher-block-preview': await version('UNBLOCK') },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.patch(roadmapPath(`/nodes/${rootId}/teacher-block`), {
          headers: { ...author, 'x-teacher-block-preview': await version('BRANCH_UNLOCK') },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post(roadmapPath(`/nodes/${dependentId}/teacher-block`), { headers: author })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.patch(roadmapPath(`/nodes/${rootId}`), {
          headers: author,
          data: { isVisible: false },
        })
      ).status(),
    ).toBe(200);

    const removedTitle = `Eliminación bloqueada ${crypto.randomUUID()}`;
    const removedId = await existingNode(removedTitle);
    const resource = await request.post(roadmapPath(`/nodes/${removedId}/resources`), {
      headers: author,
      data: {
        title: 'Material previo',
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
    expect(
      (await request.delete(roadmapPath(`/nodes/${removedId}`), { headers: author })).status(),
    ).toBe(204);

    await expect
      .poll(async () => (await noticesFor(student, removedId))[0]?.data.changeKind, {
        timeout: 70_000,
        intervals: [1000],
      })
      .toBe('node-deleted');
    const retired = (await noticesFor(student, rootId))[0];
    expect(retired).toMatchObject({
      subject: `Resumen de cambios · Nodo «${rootTitle}»`,
      data: { changeKind: 'node-retired', targetKind: 'roadmap', nodeTitle: rootTitle },
    });
    expect(JSON.stringify(retired)).not.toContain('Detalle privado');
    const deletionNotices = await noticesFor(student, removedId);
    expect(deletionNotices.map(({ data }) => data.changeKind)).toEqual([
      'node-deleted',
      'node-blocked',
      'resource-added',
    ]);
    expect(deletionNotices[0]).toMatchObject({
      subject: `Resumen de cambios · Nodo «${removedTitle}»`,
      data: { eventCount: 1, targetKind: 'roadmap', nodeTitle: removedTitle },
    });
    expect((await noticesFor(withoutProgress, removedId))[0].data.changeKind).toBe('node-deleted');
    expect(await noticesFor(fixture.cc1002WithdrawnStudent, removedId)).toHaveLength(0);
    expect(await noticesFor(fixture.daniela, removedId)).toHaveLength(0);
    await selectNotice(rootId, rootTitle);
    await selectNotice(removedId, removedTitle);
  } finally {
    for (const nodeId of nodeIds.reverse())
      await request.delete(roadmapPath(`/nodes/${nodeId}`), { headers: author });
    cleanupNotices(nodeIds);
  }
});

test('a PostgreSQL access-notice failure leaves the Node visibility change committed', async ({
  request,
}) => {
  const author = { cookie: await sessionCookie(fixture.daniela) };
  const student = { cookie: await sessionCookie(fixture.cc1002StudentWithoutProgress) };
  const roadmap = await (await request.get(roadmapPath(), { headers: author })).json();
  const nodeId = await createExistingNode({
    roadmapId: roadmap.roadmap.id,
    nodeTypeId: roadmap.nodeTypes[0].id,
    title: 'Fallo de aviso',
    positionX: 5600,
  });
  const suffix = nodeId.replaceAll('-', '');
  const triggerName = `e2e_fail_access_notice_${suffix}`;
  const functionName = `e2e_fail_access_notice_${suffix}`;
  const attemptsSequence = `e2e_access_notice_attempts_${suffix}`;

  try {
    cleanupNotices([nodeId]);
    fixtureSql(`CREATE SEQUENCE "${attemptsSequence}" START WITH 1;
      CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW."data"->>'nodeId' = '${nodeId}' THEN
          PERFORM nextval('${attemptsSequence}');
          RAISE EXCEPTION 'E2E access notice failure';
        END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER "${triggerName}" BEFORE INSERT ON "RoadmapNotice"
      FOR EACH ROW EXECUTE FUNCTION "${functionName}"();`);

    const hidden = await request.patch(roadmapPath(`/nodes/${nodeId}`), {
      headers: author,
      data: { isVisible: false },
    });
    expect(hidden.status()).toBe(200);
    expect((await hidden.json()).node).toMatchObject({ id: nodeId, isVisible: false });

    const persistedNodes = await request.get(roadmapPath('/nodes'), { headers: author });
    expect(persistedNodes.status()).toBe(200);
    expect(
      (await persistedNodes.json()).nodes.find(({ id }: { id: string }) => id === nodeId),
    ).toMatchObject({ id: nodeId, isVisible: false });
    expect(fixtureSql(`SELECT is_called::text FROM "${attemptsSequence}";`)).toContain('true');

    const notices = await request.get(
      `/api/notifications?roadmapId=${roadmap.roadmap.id}&nodeId=${nodeId}`,
      { headers: student },
    );
    expect(notices.status()).toBe(200);
    expect((await notices.json()).notifications).toHaveLength(0);
  } finally {
    fixtureSql(
      `DROP TRIGGER IF EXISTS "${triggerName}" ON "RoadmapNotice"; DROP FUNCTION IF EXISTS "${functionName}"(); DROP SEQUENCE IF EXISTS "${attemptsSequence}";`,
    );
    await request.delete(roadmapPath(`/nodes/${nodeId}`), { headers: author });
    cleanupNotices([nodeId]);
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
