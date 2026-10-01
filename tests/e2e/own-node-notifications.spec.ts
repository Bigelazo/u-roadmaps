import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { developmentFixtureIds } from '@/development';
import { expect, test } from '@playwright/test';
import { authenticateAs, fixture, roadmapPath, sessionCookie } from './helpers';

test('visible Node changes reach the own Inbox and opening recognizes only its captured notices', async ({
  request,
  page,
}) => {
  const author = { cookie: await sessionCookie(fixture.daniela) };
  const recipient = { cookie: await sessionCookie(fixture.cc1002StudentWithoutProgress) };
  const roadmap = await (await request.get(roadmapPath(), { headers: author })).json();
  const nodeTypeId = roadmap.nodeTypes[0].id;
  const title = `Aviso propio ${crypto.randomUUID()}`;
  const created = await request.post(roadmapPath('/nodes'), {
    headers: author,
    data: { title, description: 'Detalle', nodeTypeId, positionX: 0, positionY: 0 },
  });
  expect(created.status()).toBe(201);
  const nodeId = (await created.json()).node.id;
  const filter = `roadmapId=${roadmap.roadmap.id}&nodeId=${nodeId}`;
  try {
    const notices = await (
      await request.get(`/api/notifications?${filter}`, { headers: recipient })
    ).json();
    expect(notices.notifications).toHaveLength(1);
    expect(notices.notifications[0]).toMatchObject({
      subject: title,
      read: false,
      data: { nodeId, actorName: 'Daniela Rojas Mella', changeKind: 'node-available' },
    });
    await authenticateAs(page.context(), fixture.cc1002StudentWithoutProgress);
    await page.goto('/academic-overview');
    await page.getByRole('button', { name: /^Avisos(,|$)/ }).click();
    await page.getByRole('button', { name: new RegExp(title) }).click();
    await expect(page).toHaveURL(new RegExp(`targetNode=${nodeId}`));
    await expect(page.getByRole('dialog', { name: title, exact: true })).toBeVisible();
    await expect
      .poll(
        async () =>
          (
            await (
              await request.get(`/api/notifications/counts?${filter}`, { headers: recipient })
            ).json()
          ).count,
      )
      .toBe(0);
  } finally {
    await request.delete(roadmapPath(`/nodes/${nodeId}`), { headers: author });
    cleanupNotices([nodeId]);
  }
});

// Setup/cleanup only; behavior is asserted through authenticated HTTP and the browser.
function fixtureSql(sql: string) {
  const connection =
    process.env.E2E_DATABASE_URL ?? parse(readFileSync('.env.development')).E2E_DATABASE_URL;
  if (!connection || new URL(connection).pathname !== '/roadmap_e2e_db')
    throw new Error('Expected the E2E database.');
  const url = new URL(connection);
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-c', sql], {
    stdio: 'pipe',
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
function cleanupNotices(nodeIds: string[]) {
  for (const id of nodeIds)
    fixtureSql(`DELETE FROM "RoadmapNotice" WHERE "data"->>'nodeId' = '${id}';`);
}

test('Resource notices persist context and share their Node destination and acknowledgement', async ({
  request,
  page,
}) => {
  const author = { cookie: await sessionCookie(fixture.daniela) };
  const student = fixture.cc1002StudentWithoutProgress;
  const studentHeaders = { cookie: await sessionCookie(student) };
  const teacher = fixture.nicolas;
  const inactive = fixture.cc1002WithdrawnStudent;
  const roadmap = await (await request.get(roadmapPath(), { headers: author })).json();
  const nodeIds: string[] = [];
  let remainingResourceIds: string[] = [];
  const resourceTitle = `E2E material ${crypto.randomUUID()}.pdf`;
  const updatedTitle = `E2E material revisado ${crypto.randomUUID()}.pdf`;
  const secondResourceTitle = `E2E material de otra Unidad ${crypto.randomUUID()}`;
  const lateResourceTitle = `E2E material posterior ${crypto.randomUUID()}`;

  const createNode = async (title: string, positionX: number) => {
    const response = await request.post(roadmapPath('/nodes'), {
      headers: author,
      data: {
        title,
        description: 'Detalle original',
        nodeTypeId: roadmap.nodeTypes[0].id,
        positionX,
        positionY: 0,
      },
    });
    expect(response.status()).toBe(201);
    const nodeId = (await response.json()).node.id;
    nodeIds.push(nodeId);
    return nodeId;
  };
  const getNotices = async (userId: string, nodeId: string) => {
    const response = await request.get(
      `/api/notifications?roadmapId=${roadmap.roadmap.id}&nodeId=${nodeId}&limit=100`,
      { headers: { cookie: await sessionCookie(userId) } },
    );
    expect(response.status()).toBe(200);
    return (await response.json()).notifications as Array<{
      id: string;
      subject: string;
      body: string;
      createdAt: string;
      read: boolean;
      data: Record<string, unknown>;
    }>;
  };
  const resourceNotices = async (userId: string, nodeId: string) =>
    (await getNotices(userId, nodeId)).filter(
      (notice) => typeof notice.data.resourceTitle === 'string',
    );
  const count = async (nodeId: string) =>
    (
      await (
        await request.get(
          `/api/notifications/counts?roadmapId=${roadmap.roadmap.id}&nodeId=${nodeId}`,
          { headers: studentHeaders },
        )
      ).json()
    ).count;

  try {
    const nodeId = await createNode(`Recurso destino ${crypto.randomUUID()}`, 4000);
    const otherNodeId = await createNode(`Otra Unidad ${crypto.randomUUID()}`, 4400);
    const initialNodeCount = await count(nodeId);
    const initialOtherNodeCount = await count(otherNodeId);
    const resourcePath = roadmapPath(`/nodes/${nodeId}/resources`);

    const uploaded = await request.post(resourcePath, {
      headers: author,
      multipart: {
        file: {
          name: resourceTitle,
          mimeType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.7 E2E resource'),
        },
      },
    });
    expect(uploaded.status()).toBe(201);
    const uploadedResource = (await uploaded.json()).resource;
    remainingResourceIds.push(uploadedResource.id);
    const afterUpload = await resourceNotices(student, nodeId);
    expect(afterUpload).toHaveLength(1);
    expect(afterUpload[0]).toMatchObject({
      subject: `Cambio de recurso: ${resourceTitle}`,
      data: {
        targetKind: 'node',
        nodeId,
        resourceTitle,
        changeKind: 'resource-added',
      },
    });

    const failedUpdate = await request.patch(roadmapPath(`/resources/${uploadedResource.id}`), {
      headers: author,
      data: { url: 'not-a-valid-url' },
    });
    expect(failedUpdate.status()).toBe(400);
    expect(await resourceNotices(student, nodeId)).toHaveLength(1);

    const identicalUpdate = await request.patch(roadmapPath(`/resources/${uploadedResource.id}`), {
      headers: author,
      data: { title: resourceTitle },
    });
    expect(identicalUpdate.status()).toBe(200);
    expect(await resourceNotices(student, nodeId)).toHaveLength(1);

    const updated = await request.patch(roadmapPath(`/resources/${uploadedResource.id}`), {
      headers: author,
      data: { title: updatedTitle },
    });
    expect(updated.status()).toBe(200);
    const removed = await request.delete(roadmapPath(`/resources/${uploadedResource.id}`), {
      headers: author,
    });
    expect(removed.status()).toBe(204);
    remainingResourceIds = remainingResourceIds.filter((id) => id !== uploadedResource.id);

    const otherResource = await request.post(roadmapPath(`/nodes/${otherNodeId}/resources`), {
      headers: author,
      data: {
        title: secondResourceTitle,
        url: 'https://example.test/other-resource',
        type: 'LINK',
      },
    });
    expect(otherResource.status()).toBe(201);
    const otherResourceId = (await otherResource.json()).resource.id;
    remainingResourceIds.push(otherResourceId);

    const nodeChange = await request.patch(roadmapPath(`/nodes/${nodeId}`), {
      headers: author,
      data: { description: 'Detalle actualizado' },
    });
    expect(nodeChange.status()).toBe(200);

    await expect.poll(() => count(nodeId)).toBe(initialNodeCount + 4);
    await expect.poll(() => count(otherNodeId)).toBe(initialOtherNodeCount + 1);
    const noticesBeforeOpening = await getNotices(student, nodeId);
    expect(noticesBeforeOpening.map((notice) => notice.data.changeKind)).toContain('node-updated');
    expect(noticesBeforeOpening.map((notice) => notice.data.changeKind)).toContain(
      'resource-added',
    );

    const studentResourceNotices = await resourceNotices(student, nodeId);
    expect(studentResourceNotices).toHaveLength(3);
    expect(studentResourceNotices.map((notice) => notice.data.changeKind).sort()).toEqual([
      'resource-added',
      'resource-removed',
      'resource-updated',
    ]);
    const deletionNotice = studentResourceNotices.find(
      (notice) => notice.data.changeKind === 'resource-removed',
    );
    expect(deletionNotice).toMatchObject({
      subject: `Cambio de recurso: ${updatedTitle}`,
      read: false,
      data: {
        nodeId,
        nodeTitle: expect.any(String),
        resourceTitle: updatedTitle,
        actorName: 'Daniela Rojas Mella',
        occurredAt: expect.any(String),
      },
    });
    expect(Number.isNaN(Date.parse(deletionNotice!.createdAt))).toBe(false);
    expect(Number.isNaN(Date.parse(String(deletionNotice!.data.occurredAt)))).toBe(false);
    expect(JSON.stringify(studentResourceNotices)).not.toMatch(/https?:|description|bytes/i);

    expect(await resourceNotices(fixture.daniela, nodeId)).toHaveLength(0);
    expect(await resourceNotices(inactive, nodeId)).toHaveLength(0);
    expect(await resourceNotices(teacher, nodeId)).toHaveLength(3);

    await authenticateAs(page.context(), student);
    await page.goto('/academic-overview');
    await page.getByRole('button', { name: /^Avisos(,|$)/ }).click();
    await page
      .getByRole('button', { name: new RegExp(updatedTitle) })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`targetNode=${nodeId}`));
    await expect(
      page.getByRole('dialog', { name: `Cambio de recurso: ${updatedTitle}` }),
    ).toBeVisible();
    await expect.poll(() => count(nodeId)).toBe(0);
    expect(await count(otherNodeId)).toBe(initialOtherNodeCount + 1);

    const lateResource = await request.post(resourcePath, {
      headers: author,
      data: {
        title: lateResourceTitle,
        url: 'https://example.test/late-resource',
        type: 'LINK',
      },
    });
    expect(lateResource.status()).toBe(201);
    const lateResourceId = (await lateResource.json()).resource.id;
    remainingResourceIds.push(lateResourceId);
    await expect.poll(() => count(nodeId)).toBe(1);

    const otherNodeResourceNotices = await resourceNotices(student, otherNodeId);
    expect(otherNodeResourceNotices).toHaveLength(1);
    const cascadeKindsBefore = (await resourceNotices(student, nodeId)).map(
      (notice) => notice.data.changeKind,
    );
    const cascade = await request.delete(roadmapPath(`/nodes/${nodeId}`), { headers: author });
    expect(cascade.status()).toBe(204);
    const cascadeNotices = await resourceNotices(student, nodeId);
    expect(cascadeNotices.map((notice) => notice.data.changeKind)).toEqual(cascadeKindsBefore);
    expect(cascadeNotices.some((notice) => notice.data.changeKind === 'resource-removed')).toBe(
      true,
    );

    const otherNodeDelete = await request.delete(roadmapPath(`/nodes/${otherNodeId}`), {
      headers: author,
    });
    expect(otherNodeDelete.status()).toBe(204);
    const afterOtherCascade = await resourceNotices(student, otherNodeId);
    expect(afterOtherCascade).toHaveLength(1);
    expect(afterOtherCascade[0]?.data.changeKind).toBe('resource-added');
  } finally {
    for (const resourceId of remainingResourceIds) {
      await request.delete(roadmapPath(`/resources/${resourceId}`), { headers: author });
    }
    for (const nodeId of nodeIds.reverse()) {
      await request.delete(roadmapPath(`/nodes/${nodeId}`), { headers: author });
    }
    cleanupNotices(nodeIds);
  }
});

test('Node opening captures every page, preserves later arrivals and other Nodes through retry and refresh', async ({
  request,
  page,
}) => {
  const author = { cookie: await sessionCookie(fixture.daniela) };
  const recipient = { cookie: await sessionCookie(fixture.cc1002StudentWithoutProgress) };
  const roadmap = await (await request.get(roadmapPath(), { headers: author })).json();
  const ids: string[] = [];
  const create = async (title: string) => {
    const response = await request.post(roadmapPath('/nodes'), {
      headers: author,
      data: {
        title,
        nodeTypeId: roadmap.nodeTypes[0].id,
        positionX: 600 + ids.length * 400,
        positionY: 0,
      },
    });
    expect(response.status()).toBe(201);
    const id = (await response.json()).node.id;
    ids.push(id);
    return id;
  };
  try {
    const nodeId = await create(`Nodo de avisos ${crypto.randomUUID()}`);
    const otherId = await create(`Otro ${crypto.randomUUID()}`);
    for (let index = 0; index < 11; index++) {
      expect(
        (
          await request.patch(roadmapPath(`/nodes/${nodeId}`), {
            headers: author,
            data: { description: `Cambio ${index}` },
          })
        ).status(),
      ).toBe(200);
    }
    // Future notice classes use the same Node recognition contract.
    for (const [changeKind, subject] of [
      ['resource-added', 'Recurso'],
      ['node-updated', 'Resumen de cambios · Nodo'],
    ]) {
      fixtureSql(
        `INSERT INTO "RoadmapNotice" ("id", "eventId", "recipientId", "roadmapId", "courseOfferingId", "subject", "body", "data", "occurredAt") VALUES ('${crypto.randomUUID()}', '${crypto.randomUUID()}', '${fixture.cc1002StudentWithoutProgress}', '${roadmap.roadmap.id}', '${developmentFixtureIds.offerings.cc1002}', '${subject}', 'Aviso futuro', '{"nodeId":"${nodeId}","targetKind":"node","changeKind":"${changeKind}","roadmapId":"${roadmap.roadmap.id}","courseCode":"CC1002","year":2026,"semester":2,"occurredAt":"2026-10-01T12:00:00Z","actorName":"Daniela","eventCount":2}', NOW());`,
      );
    }
    const filter = `roadmapId=${roadmap.roadmap.id}&nodeId=${nodeId}`;
    const count = async (id = nodeId) =>
      (
        await (
          await request.get(
            `/api/notifications/counts?roadmapId=${roadmap.roadmap.id}&nodeId=${id}`,
            { headers: recipient },
          )
        ).json()
      ).count;
    expect(await count()).toBe(14);
    await authenticateAs(page.context(), fixture.cc1002StudentWithoutProgress);
    await page.goto('/courses/CC1002/2026/2');
    expect(await count()).toBe(14);
    const graphNode = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
    await graphNode.getByRole('button', { name: '14 avisos sin leer para este Nodo' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Cargar más avisos' })).toBeVisible();
    expect(await count()).toBe(14);
    expect(await count(otherId)).toBe(1);
    await page.keyboard.press('Escape');
    let fail = true;
    const operations: string[] = [];
    await page.route('**/api/notifications/acknowledge', async (route) => {
      const input = route.request().postDataJSON();
      operations.push(input.operationId);
      if (fail) await route.abort();
      else await route.continue();
    });
    await graphNode.click({ timeout: 5000 });
    await expect(page.getByText('No se pudieron reconocer algunos avisos.')).toBeVisible();
    const old = await (
      await request.get(`/api/notifications?${filter}&limit=100`, { headers: recipient })
    ).json();
    expect(old.notifications).toHaveLength(14);
    // Delivery happens after the opening snapshot, while acknowledgement is failing.
    await request.patch(roadmapPath(`/nodes/${nodeId}`), {
      headers: author,
      data: { description: 'Llegada posterior' },
    });
    fail = false;
    await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
    await expect.poll(() => count()).toBe(1);
    expect(new Set(operations).size).toBe(1);
    expect(await count(otherId)).toBe(1);
    const retained = await (
      await request.get(`/api/notifications?${filter}&limit=100`, { headers: recipient })
    ).json();
    expect(retained.notifications.filter((notice: { read: boolean }) => notice.read)).toHaveLength(
      14,
    );
    await page.reload();
    expect(await count()).toBe(1);
    await page.locator(`.react-flow__node[data-id="${nodeId}"]`).click();
    await expect.poll(() => count()).toBe(0);
  } finally {
    for (const id of ids.reverse())
      await request.delete(roadmapPath(`/nodes/${id}`), { headers: author });
    cleanupNotices(ids);
  }
});

test('content notices follow individual prerequisites, teacher policy, inactive exclusion and publication', async ({
  request,
}) => {
  const author = { cookie: await sessionCookie(fixture.daniela) };
  const roadmap = await (await request.get(roadmapPath(), { headers: author })).json();
  const ids: string[] = [];
  let dependencyId: string | undefined;
  const observer = crypto.randomUUID();
  const outsider = crypto.randomUUID();
  // The current persistence model represents observers with the student-equivalent role.
  fixtureSql(
    `INSERT INTO "User" ("id", "name", "institutionalEmail") VALUES ('${observer}', 'Observador', '${observer}@u-roadmaps.test'); INSERT INTO "Participation" ("id", "userId", "courseOfferingId", "role", "isActive") VALUES ('${crypto.randomUUID()}', '${observer}', '${developmentFixtureIds.offerings.cc1002}', 'STUDENT', true);`,
  );
  fixtureSql(
    `INSERT INTO "User" ("id", "name", "institutionalEmail") VALUES ('${outsider}', 'Otro Curso', '${outsider}@u-roadmaps.test'); INSERT INTO "Participation" ("id", "userId", "courseOfferingId", "role", "isActive") VALUES ('${crypto.randomUUID()}', '${outsider}', '${developmentFixtureIds.offerings.ma1001}', 'STUDENT', true);`,
  );
  const without = fixture.cc1002StudentWithoutProgress;
  const withProgress = fixture.cc1002StudentWithProgress;
  const count = async (userId: string, nodeId: string) =>
    (
      await (
        await request.get(`/api/notifications/counts?nodeId=${nodeId}`, {
          headers: { cookie: await sessionCookie(userId) },
        })
      ).json()
    ).count;
  const create = async (isVisible: boolean) => {
    const response = await request.post(roadmapPath('/nodes'), {
      headers: author,
      data: {
        title: `Audiencia ${crypto.randomUUID()}`,
        description: 'Detalle',
        nodeTypeId: roadmap.nodeTypes[0].id,
        positionX: 0,
        positionY: 0,
        isVisible,
      },
    });
    expect(response.status()).toBe(201);
    const id = (await response.json()).node.id;
    ids.push(id);
    return id;
  };
  try {
    const prerequisite = await create(true);
    const nodeId = await create(true);
    const hidden = await create(false);
    expect(await count(observer, nodeId)).toBe(1);
    for (const excluded of [fixture.daniela, fixture.cc1002WithdrawnStudent, outsider])
      expect(await count(excluded, nodeId)).toBe(0);
    expect(await count(without, hidden)).toBe(0);
    await request.patch(roadmapPath(`/nodes/${hidden}`), {
      headers: author,
      data: { description: 'Oculto' },
    });
    expect(await count(without, hidden)).toBe(0);
    await request.patch(roadmapPath(`/nodes/${hidden}`), {
      headers: author,
      data: { isVisible: true },
    });
    expect(await count(without, hidden)).toBe(1);
    const dependency = await request.post(roadmapPath('/dependencies'), {
      headers: author,
      data: { sourceNodeId: prerequisite, targetNodeId: nodeId },
    });
    expect(dependency.status()).toBe(201);
    dependencyId = (await dependency.json()).dependency.id;
    expect(
      (
        await request.post(roadmapPath(`/nodes/${prerequisite}/completion`), {
          headers: { cookie: await sessionCookie(withProgress) },
        })
      ).status(),
    ).toBe(200);
    for (const data of [
      { description: 'Nuevo detalle' },
      { title: 'Nuevo título' },
      { nodeTypeId: roadmap.nodeTypes[1].id },
    ]) {
      expect(
        (await request.patch(roadmapPath(`/nodes/${nodeId}`), { headers: author, data })).status(),
      ).toBe(200);
    }
    expect(await count(without, nodeId)).toBe(1);
    expect(await count(observer, nodeId)).toBe(1);
    expect(await count(withProgress, nodeId)).toBe(4);
    expect(await count(fixture.nicolas, nodeId)).toBe(4);
    for (const data of [{ title: 'Nuevo título' }, { positionX: 99, positionY: 99 }])
      await request.patch(roadmapPath(`/nodes/${nodeId}`), { headers: author, data });
    expect(await count(withProgress, nodeId)).toBe(4);
    const opening = { roadmapId: roadmap.roadmap.id, nodeId, operationId: crypto.randomUUID() };
    expect((await request.post('/api/notifications/openings', { data: opening })).status()).toBe(
      401,
    );
    for (const userId of [without, observer, outsider, fixture.cc1002WithdrawnStudent])
      expect(
        (
          await request.post('/api/notifications/openings', {
            headers: { cookie: await sessionCookie(userId) },
            data: opening,
          })
        ).status(),
      ).toBe(403);
    expect(
      (
        await request.post('/api/notifications/openings', {
          headers: { cookie: await sessionCookie(withProgress) },
          data: { ...opening, retry: true },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await request.post('/api/notifications/openings', {
          headers: { cookie: await sessionCookie(withProgress) },
          data: opening,
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post(roadmapPath(`/nodes/${nodeId}/teacher-block`), { headers: author })
      ).status(),
    ).toBe(200);
    await request.patch(roadmapPath(`/nodes/${nodeId}`), {
      headers: author,
      data: { description: 'Bloqueado por docencia' },
    });
    expect(await count(fixture.nicolas, nodeId)).toBe(4);
    expect(await count(withProgress, nodeId)).toBe(4);
  } finally {
    if (dependencyId)
      await request.delete(roadmapPath(`/dependencies/${dependencyId}`), { headers: author });
    for (const id of ids.reverse())
      await request.delete(roadmapPath(`/nodes/${id}`), { headers: author });
    cleanupNotices(ids);
    fixtureSql(`DELETE FROM "User" WHERE "id" IN ('${observer}', '${outsider}');`);
  }
});

test('Canvas preview does not recognize notices and opening the teaching Node does', async ({
  request,
  page,
}) => {
  const author = { cookie: await sessionCookie(fixture.daniela) };
  const recipient = { cookie: await sessionCookie(fixture.nicolas) };
  const roadmap = await (await request.get(roadmapPath(), { headers: author })).json();
  const created = await request.post(roadmapPath('/nodes'), {
    headers: author,
    data: {
      title: `Preview ${crypto.randomUUID()}`,
      nodeTypeId: roadmap.nodeTypes[0].id,
      positionX: 600,
      positionY: 0,
    },
  });
  expect(created.status()).toBe(201);
  const nodeId = (await created.json()).node.id;
  const count = async () =>
    (
      await (
        await request.get(`/api/notifications/counts?nodeId=${nodeId}`, { headers: recipient })
      ).json()
    ).count;
  try {
    await authenticateAs(page.context(), fixture.nicolas);
    await page.goto('/courses/CC1002/2026/2');
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith('/simulation') && response.request().method() === 'GET',
      ),
      page.getByRole('button', { name: 'Vista estudiante' }).click(),
    ]);
    await expect(page.getByText('Previsualización del canvas')).toBeVisible();
    await page.locator(`.react-flow__node[data-id="${nodeId}"]`).click();
    await expect(page.getByRole('button', { name: 'Cerrar detalle' })).toBeVisible();
    expect(await count()).toBe(1);
    await page.getByRole('button', { name: 'Ir al editor' }).click();
    await page.locator(`.react-flow__node[data-id="${nodeId}"]`).click();
    await expect.poll(() => count()).toBe(0);
  } finally {
    await request.delete(roadmapPath(`/nodes/${nodeId}`), { headers: author });
    cleanupNotices([nodeId]);
  }
});
