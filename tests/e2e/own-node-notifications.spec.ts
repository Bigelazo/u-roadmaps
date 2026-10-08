import { enterRoadmap } from './enter-roadmap';
import { expect, test } from './fixtures';
import { sql } from './database';
import { authenticateAs, sessionCookie } from './helpers';

test('visible Node changes reach the Inbox and Roadmap entry recognizes them', async ({
  request,
  course,
  page,
}) => {
  const roadmapPath = course.apiPath;
  const author = { cookie: await sessionCookie(course.users.teacher.id) };
  const recipient = { cookie: await sessionCookie(course.users.studentWithoutProgress.id) };
  const roadmap = await (await request.get(roadmapPath(), { headers: author })).json();
  await enterRoadmap(page, course.pagePath(), course.users.studentWithoutProgress.id);
  await page.goto('/academic-overview');
  const nodeTypeId = roadmap.nodeTypes[0].id;
  const title = `Aviso propio ${crypto.randomUUID()}`;
  const created = await request.post(roadmapPath('/nodes'), {
    headers: author,
    data: { title, description: 'Detalle', nodeTypeId, positionX: 0, positionY: 0 },
  });
  expect(created.status()).toBe(201);
  const nodeId = (await created.json()).node.id;
  const filter = `roadmapId=${roadmap.roadmap.id}&nodeId=${nodeId}`;
  await expect
    .poll(
      async () =>
        (await (await request.get(`/api/notifications?${filter}`, { headers: recipient })).json())
          .notifications.length,
    )
    .toBe(1);
  const notices = await (
    await request.get(`/api/notifications?${filter}`, { headers: recipient })
  ).json();
  expect(notices.notifications).toHaveLength(1);
  expect(notices.notifications[0]).toMatchObject({
    subject: `Nuevo Nodo «${title}»`,
    read: false,
    data: { nodeId, actorName: course.users.teacher.name, changeKind: 'node-available' },
  });
  await authenticateAs(page.context(), course.users.studentWithoutProgress.id);
  await page.goto('/academic-overview');
  await page.getByRole('button', { name: /^Avisos(,|$)/ }).click();
  await page.getByRole('button', { name: new RegExp(title) }).click();
  await expect(page).toHaveURL(course.pagePath());
  await expect(
    page.getByRole('dialog', { name: `Cambios en el Roadmap de ${course.courseCode}` }),
  ).toBeVisible();
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
});

test('Resource notices persist context and share Roadmap entry recognition', async ({
  request,
  course,
  page,
}) => {
  const roadmapPath = course.apiPath;
  const author = { cookie: await sessionCookie(course.users.teacher.id) };
  const student = course.users.studentWithoutProgress.id;
  const studentHeaders = { cookie: await sessionCookie(student) };
  const teacher = course.users.teachingAssistant.id;
  const inactive = course.users.withdrawnStudent.id;
  const roadmap = await (await request.get(roadmapPath(), { headers: author })).json();
  await enterRoadmap(page, course.pagePath(), student);
  await page.goto('/academic-overview');
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

  const nodeId = await createNode(`Recurso destino ${crypto.randomUUID()}`, 4000);
  const otherNodeId = await createNode(`Otra Unidad ${crypto.randomUUID()}`, 4400);
  await expect.poll(() => count(nodeId)).toBe(1);
  await expect.poll(() => count(otherNodeId)).toBe(1);
  // Resource targets are independent after the new Nodes have been recognized.
  for (const userId of [student, teacher]) {
    const headers = { cookie: await sessionCookie(userId) };
    const opening = { roadmapId: course.roadmapId, operationId: crypto.randomUUID() };
    expect(
      (await request.post('/api/notifications/openings', { headers, data: opening })).status(),
    ).toBe(200);
    expect(
      (await request.post('/api/notifications/acknowledge', { headers, data: opening })).status(),
    ).toBe(200);
  }
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
  await expect.poll(() => resourceNotices(student, nodeId)).toHaveLength(1);
  const afterUpload = await resourceNotices(student, nodeId);
  expect(afterUpload).toHaveLength(1);
  expect(afterUpload[0]).toMatchObject({
    subject: resourceTitle,
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
  await expect.poll(() => resourceNotices(student, nodeId)).toHaveLength(1);

  const identicalUpdate = await request.patch(roadmapPath(`/resources/${uploadedResource.id}`), {
    headers: author,
    data: { title: resourceTitle },
  });
  expect(identicalUpdate.status()).toBe(200);
  await expect.poll(() => resourceNotices(student, nodeId)).toHaveLength(1);

  const updated = await request.patch(roadmapPath(`/resources/${uploadedResource.id}`), {
    headers: author,
    data: { title: updatedTitle },
  });
  expect(updated.status()).toBe(200);
  const removed = await request.delete(roadmapPath(`/resources/${uploadedResource.id}`), {
    headers: author,
  });
  expect(removed.status()).toBe(204);

  const otherResource = await request.post(roadmapPath(`/nodes/${otherNodeId}/resources`), {
    headers: author,
    data: {
      title: secondResourceTitle,
      url: 'https://example.test/other-resource',
      type: 'LINK',
    },
  });
  expect(otherResource.status()).toBe(201);

  const nodeChange = await request.patch(roadmapPath(`/nodes/${nodeId}`), {
    headers: author,
    data: { description: 'Detalle actualizado' },
  });
  expect(nodeChange.status()).toBe(200);

  // The unrecognized addition was removed: only the Node update remains (#181).
  await expect.poll(() => count(nodeId)).toBe(initialNodeCount + 1);
  await expect.poll(() => count(otherNodeId)).toBe(initialOtherNodeCount + 1);
  const noticesBeforeOpening = await getNotices(student, nodeId);
  expect(noticesBeforeOpening.map((notice) => notice.data.changeKind)).toContain('node-updated');
  expect(noticesBeforeOpening.map((notice) => notice.data.changeKind)).not.toContain(
    'resource-added',
  );

  const studentResourceNotices = await resourceNotices(student, nodeId);
  expect(studentResourceNotices).toHaveLength(0);
  expect(JSON.stringify(await resourceNotices(student, otherNodeId))).not.toMatch(
    /https?:|description|bytes/i,
  );

  expect(await resourceNotices(course.users.teacher.id, nodeId)).toHaveLength(0);
  expect(await resourceNotices(inactive, nodeId)).toHaveLength(0);
  await expect.poll(() => resourceNotices(teacher, nodeId)).toHaveLength(0);

  await authenticateAs(page.context(), student);
  await page.goto('/academic-overview');
  await page.getByRole('button', { name: /^Avisos(,|$)/ }).click();
  await page
    .getByRole('button', {
      name: new RegExp(secondResourceTitle),
    })
    .first()
    .click();
  await expect(page).toHaveURL(course.pagePath());
  await expect(
    page.getByRole('dialog', { name: `Cambios en el Roadmap de ${course.courseCode}` }),
  ).toBeVisible();
  await expect.poll(() => count(nodeId)).toBe(0);
  await expect.poll(() => count(otherNodeId)).toBe(0);

  const lateResource = await request.post(resourcePath, {
    headers: author,
    data: {
      title: lateResourceTitle,
      url: 'https://example.test/late-resource',
      type: 'LINK',
    },
  });
  expect(lateResource.status()).toBe(201);
  await expect.poll(() => count(nodeId)).toBe(1);

  const otherNodeResourceNotices = await resourceNotices(student, otherNodeId);
  expect(otherNodeResourceNotices).toHaveLength(0);
  const cascade = await request.delete(roadmapPath(`/nodes/${nodeId}`), { headers: author });
  expect(cascade.status()).toBe(204);
  await expect.poll(() => resourceNotices(student, nodeId)).toHaveLength(0);
  await expect.poll(() => getNotices(student, nodeId)).toHaveLength(1);
  expect((await getNotices(student, nodeId))[0].data.changeKind).toBe('node-deleted');

  const otherNodeDelete = await request.delete(roadmapPath(`/nodes/${otherNodeId}`), {
    headers: author,
  });
  expect(otherNodeDelete.status()).toBe(204);
  const afterOtherCascade = await resourceNotices(student, otherNodeId);
  expect(afterOtherCascade).toHaveLength(0);
});

test('failed Roadmap entry recognition preserves every page and Node without a banner', async ({
  request,
  course,
  page,
}) => {
  const roadmapPath = course.apiPath;
  const author = { cookie: await sessionCookie(course.users.teacher.id) };
  const recipient = { cookie: await sessionCookie(course.users.studentWithoutProgress.id) };
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
  const nodeId = await create(`Nodo de avisos ${crypto.randomUUID()}`);
  await create(`Otro ${crypto.randomUUID()}`);
  // Historical notices from separate windows exercise pagination independently
  // of the live 60-second grouping contract.
  for (let index = 0; index < 11; index++)
    await sql(
      `INSERT INTO "RoadmapNotice" ("id", "eventId", "recipientId", "roadmapId", "courseOfferingId", "subject", "body", "data", "occurredAt") VALUES ('${crypto.randomUUID()}', '${crypto.randomUUID()}', '${course.users.studentWithoutProgress.id}', '${roadmap.roadmap.id}', '${course.id}', 'Cambio anterior ${index}', 'Aviso histórico', '{"nodeId":"${nodeId}","targetKind":"node","changeKind":"node-updated"}', NOW());`,
    );
  // Future notice classes use the same Node recognition contract.
  for (const [changeKind, subject] of [
    ['resource-added', 'Recurso'],
    ['node-updated', 'Resumen de cambios · Nodo'],
  ]) {
    await sql(
      `INSERT INTO "RoadmapNotice" ("id", "eventId", "recipientId", "roadmapId", "courseOfferingId", "subject", "body", "data", "occurredAt") VALUES ('${crypto.randomUUID()}', '${crypto.randomUUID()}', '${course.users.studentWithoutProgress.id}', '${roadmap.roadmap.id}', '${course.id}', '${subject}', 'Aviso futuro', '{"nodeId":"${nodeId}","targetKind":"node","changeKind":"${changeKind}","roadmapId":"${roadmap.roadmap.id}","courseCode":"${course.courseCode}","year":2026,"semester":2,"occurredAt":"2026-10-01T12:00:00Z","actorName":"Daniela","eventCount":2}', NOW());`,
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
  await expect.poll(() => count()).toBe(14);
  await authenticateAs(page.context(), course.users.studentWithoutProgress.id);
  const fail = true;
  const operations: string[] = [];
  await page.route('**/api/notifications/acknowledge', async (route) => {
    operations.push(route.request().postDataJSON().operationId);
    if (fail) await route.abort();
    else await route.continue();
  });
  await page.goto(course.pagePath());
  await expect(page.getByText('No se pudieron reconocer algunos avisos.')).toHaveCount(0);
  const old = await (
    await request.get(`/api/notifications?${filter}&limit=100`, { headers: recipient })
  ).json();
  expect(old.notifications).toHaveLength(14);
});

test('content notices follow individual prerequisites, teacher policy, inactive exclusion and publication', async ({
  request,
  course,
  createUser,
  createCourse,
}) => {
  const roadmapPath = course.apiPath;
  const author = { cookie: await sessionCookie(course.users.teacher.id) };
  const roadmap = await (await request.get(roadmapPath(), { headers: author })).json();
  const observer = (await createUser()).id;
  const outsiderUser = await createUser();
  const outsider = outsiderUser.id;
  // The current persistence model represents observers with the student-equivalent role.
  await sql(
    `INSERT INTO "Participation" ("id", "userId", "courseOfferingId", "role", "isActive") VALUES ('${crypto.randomUUID()}', '${observer}', '${course.id}', 'STUDENT', true);`,
  );
  await createCourse({ participants: [{ user: outsiderUser, role: 'STUDENT' }] });
  const without = course.users.studentWithoutProgress.id;
  const withProgress = course.users.studentWithProgress.id;
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
    return id;
  };
  const prerequisite = await create(true);
  const nodeId = await create(true);
  const hidden = await create(false);
  await expect.poll(() => count(observer, nodeId)).toBe(1);
  for (const excluded of [course.users.teacher.id, course.users.withdrawnStudent.id, outsider])
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
  await expect.poll(() => count(without, hidden)).toBe(1);
  // Recognize publication before testing independent content and access targets.
  for (const userId of [without, observer, withProgress, course.users.teachingAssistant.id]) {
    const headers = { cookie: await sessionCookie(userId) };
    const opening = { roadmapId: course.roadmapId, operationId: crypto.randomUUID() };
    expect(
      (await request.post('/api/notifications/openings', { headers, data: opening })).status(),
    ).toBe(200);
    expect(
      (await request.post('/api/notifications/acknowledge', { headers, data: opening })).status(),
    ).toBe(200);
  }
  const dependency = await request.post(roadmapPath('/dependencies'), {
    headers: author,
    data: { sourceNodeId: prerequisite, targetNodeId: nodeId },
  });
  expect(dependency.status()).toBe(201);
  // Dependency access notices are delivered after the HTTP response. Wait for
  // them before capturing the baseline for the subsequent content changes.
  for (const userId of [without, observer, withProgress])
    await expect.poll(() => count(userId, nodeId)).toBe(1);
  expect(
    (
      await request.post(roadmapPath(`/nodes/${prerequisite}/completion`), {
        headers: { cookie: await sessionCookie(withProgress) },
      })
    ).status(),
  ).toBe(200);
  const beforeContent = new Map(
    await Promise.all(
      [without, observer, withProgress, course.users.teachingAssistant.id].map(
        async (userId) => [userId, await count(userId, nodeId)] as const,
      ),
    ),
  );
  for (const data of [
    { description: 'Nuevo detalle' },
    { title: 'Nuevo título' },
    { nodeTypeId: roadmap.nodeTypes[1].id },
  ]) {
    expect(
      (await request.patch(roadmapPath(`/nodes/${nodeId}`), { headers: author, data })).status(),
    ).toBe(200);
  }
  // Title and type are visible even when prerequisites block the Node;
  // description follows the accessible-content audience.
  await expect.poll(() => count(without, nodeId)).toBe(beforeContent.get(without)! + 2);
  await expect.poll(() => count(observer, nodeId)).toBe(beforeContent.get(observer)! + 2);
  await expect
    .poll(() => count(withProgress, nodeId))
    .toBeGreaterThan(beforeContent.get(withProgress)!);
  await expect
    .poll(() => count(course.users.teachingAssistant.id, nodeId))
    .toBeGreaterThan(beforeContent.get(course.users.teachingAssistant.id)!);
  const afterContent = await count(withProgress, nodeId);
  for (const data of [{ title: 'Nuevo título' }, { positionX: 99, positionY: 99 }])
    await request.patch(roadmapPath(`/nodes/${nodeId}`), { headers: author, data });
  await expect.poll(() => count(withProgress, nodeId)).toBe(afterContent);
  const latestKind = async (userId: string) => {
    const response = await request.get(`/api/notifications?nodeId=${nodeId}`, {
      headers: { cookie: await sessionCookie(userId) },
    });
    expect(response.status()).toBe(200);
    return (await response.json()).notifications[0]?.data.changeKind;
  };
  await expect.poll(() => latestKind(withProgress)).toBe('node-updated');
  expect(await latestKind(course.users.teachingAssistant.id)).toBe('node-updated');
  expect(await latestKind(without)).toBe('node-updated');
  expect(await latestKind(observer)).toBe('node-updated');
  const opening = { roadmapId: roadmap.roadmap.id, operationId: crypto.randomUUID() };
  expect((await request.post('/api/notifications/openings', { data: opening })).status()).toBe(401);
  for (const userId of [outsider, course.users.withdrawnStudent.id])
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
  await expect.poll(() => latestKind(withProgress)).toBe('node-blocked');
  await expect.poll(() => latestKind(course.users.teachingAssistant.id)).toBe('node-blocked');
  const teacherCountAfterBlock = await count(course.users.teachingAssistant.id, nodeId);
  const studentCountAfterBlock = await count(withProgress, nodeId);
  await request.patch(roadmapPath(`/nodes/${nodeId}`), {
    headers: author,
    data: { description: 'Bloqueado por docencia' },
  });
  await expect
    .poll(() => count(course.users.teachingAssistant.id, nodeId))
    .toBe(teacherCountAfterBlock);
  await expect.poll(() => count(withProgress, nodeId)).toBe(studentCountAfterBlock);
});

test('Canvas preview and opening the teaching Node leave later notices pending', async ({
  request,
  course,
  page,
}) => {
  const roadmapPath = course.apiPath;
  const author = { cookie: await sessionCookie(course.users.teacher.id) };
  const recipient = { cookie: await sessionCookie(course.users.teachingAssistant.id) };
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
  await authenticateAs(page.context(), course.users.teachingAssistant.id);
  await page.goto(course.pagePath());
  await expect.poll(() => count()).toBe(0);
  expect(
    (
      await request.patch(roadmapPath(`/nodes/${nodeId}`), {
        headers: author,
        data: { description: 'Cambio posterior a la entrada' },
      })
    ).status(),
  ).toBe(200);
  await expect.poll(() => count()).toBe(1);
  await Promise.all([
    page.waitForResponse(
      (response) => response.url().endsWith('/simulation') && response.request().method() === 'GET',
    ),
    page.getByRole('button', { name: 'Vista estudiante' }).click(),
  ]);
  await expect(page.getByText('Previsualización del canvas')).toBeVisible();
  await page.locator(`.react-flow__node[data-id="${nodeId}"]`).click();
  await expect(page.getByRole('button', { name: 'Cerrar detalle' })).toBeVisible();
  await expect.poll(() => count()).toBe(1);
  await page.getByRole('button', { name: 'Ir al editor' }).click();
  await page.locator(`.react-flow__node[data-id="${nodeId}"]`).click();
  await expect.poll(() => count()).toBe(1);
});
