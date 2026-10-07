import { expect, test } from './fixtures';
import { authenticateAs } from './helpers';
import { createExistingNode } from './existing-node';
import { literal, sql } from './database';
import type { Page } from '@playwright/test';

type StreamFrame = { kind: string; data: { userId: string; courseCode?: string } };
type StreamWindow = Window & { notificationFrames: StreamFrame[] };

async function openNativeStream(page: Page) {
  await page.goto('/api/notifications/counts');
  await page.evaluate(() => {
    const frames: StreamFrame[] = [];
    (window as unknown as StreamWindow).notificationFrames = frames;
    const source = new EventSource('/api/notifications/stream');
    for (const kind of ['ready', 'inbox', 'roadmap']) {
      source.addEventListener(kind, (event) => {
        frames.push({ kind, data: JSON.parse((event as MessageEvent).data) });
      });
    }
  });
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as StreamWindow).notificationFrames[0]?.kind),
    )
    .toBe('ready');
}

test('native SSE isolates Inbox and Roadmap frames from a User outside the Course', async ({
  browser,
  course,
  apiAs,
  createUser,
}, testInfo) => {
  const outsider = await createUser();
  const baseURL = testInfo.project.use.baseURL as string;
  const recipientContext = await browser.newContext({ baseURL });
  const outsiderContext = await browser.newContext({ baseURL });
  try {
    await authenticateAs(recipientContext, course.users.studentWithProgress.id);
    await authenticateAs(outsiderContext, outsider.id);
    const recipientPage = await recipientContext.newPage();
    const outsiderPage = await outsiderContext.newPage();
    await Promise.all([openNativeStream(recipientPage), openNativeStream(outsiderPage)]);
    const teacher = await apiAs(course.users.teacher);
    expect(
      (
        await teacher.patch(course.apiPath(`/nodes/${course.nodes.first}`), {
          data: { description: 'Cambio visible solo para participantes' },
        })
      ).status(),
    ).toBe(200);
    await expect
      .poll(() =>
        recipientPage.evaluate(() =>
          (window as unknown as StreamWindow).notificationFrames.map((frame) => frame.kind),
        ),
      )
      .toEqual(expect.arrayContaining(['inbox', 'roadmap']));
    const delivered = await recipientPage.evaluate(
      () => (window as unknown as StreamWindow).notificationFrames,
    );
    expect(delivered).toEqual(
      expect.arrayContaining([
        { kind: 'inbox', data: { userId: course.users.studentWithProgress.id } },
        expect.objectContaining({
          kind: 'roadmap',
          data: expect.objectContaining({
            courseCode: course.courseCode,
            userId: course.users.studentWithProgress.id,
          }),
        }),
      ]),
    );
    // A bounded observation of the real connection would catch either leaked signal.
    await expect(
      outsiderPage.waitForFunction(
        () =>
          (window as unknown as StreamWindow).notificationFrames.some(
            (frame) => frame.kind !== 'ready',
          ),
        undefined,
        { timeout: 2000 },
      ),
    ).rejects.toThrow(/Timeout/);
    expect(
      await outsiderPage.evaluate(() => (window as unknown as StreamWindow).notificationFrames),
    ).toEqual([{ kind: 'ready', data: { userId: outsider.id } }]);
  } finally {
    await recipientContext.close();
    await outsiderContext.close();
  }
});

test('Resource notices stream to two tabs while student content stays stable until re-entry', async ({
  browser,
  course,
}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL as string;
  const teacher = await browser.newContext({ baseURL });
  const student = await browser.newContext({ baseURL });
  try {
    await authenticateAs(teacher, course.users.teacher.id);
    await authenticateAs(student, course.users.studentWithoutProgress.id);
    const roadmap = await (await teacher.request.get(course.apiPath())).json();
    const nodeId = await createExistingNode({
      roadmapId: course.roadmapId,
      nodeTypeId: roadmap.nodeTypes[0].id,
      title: 'Material de estudio',
    });
    const page = await student.newPage();
    const other = await student.newPage();
    const stream = page.waitForResponse((response) =>
      response.url().endsWith('/api/notifications/stream'),
    );
    await page.goto(`${course.pagePath()}?targetNode=${nodeId}`);
    const response = await stream;
    expect(response.headers()['content-type']).toContain('text/event-stream');
    expect(response.headers()['x-accel-buffering']).toBe('no');
    expect(response.headers()['cache-control']).toContain('no-transform');
    await other.goto('/academic-overview');
    await other.getByRole('button', { name: 'Avisos', exact: true }).click();
    const path = course.apiPath(`/nodes/${nodeId}/resources`);
    const created = await teacher.request.post(path, {
      data: { title: 'Primera guía', type: 'LINK', url: 'https://example.test/guide' },
    });
    expect(created.status()).toBe(201);
    const resourceId = (await created.json()).resource.id;
    await expect(other.getByRole('button', { name: /Primera guía/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Primera guía' })).toBeHidden();
    await expect(
      page.getByRole('button', { name: 'Avisos, 1 sin leer', exact: true }),
    ).toBeVisible();
    await expect(
      other.getByRole('button', { name: 'Avisos, 1 sin leer', exact: true }),
    ).toBeVisible();
    const notices = async () =>
      (await (await student.request.get(`/api/notifications?nodeId=${nodeId}`)).json())
        .notifications;
    const first = (await notices())[0];
    for (const title of ['Segunda guía', 'Última guía']) {
      expect(
        (
          await teacher.request.patch(course.apiPath(`/resources/${resourceId}`), {
            data: { title },
          })
        ).status(),
      ).toBe(200);
    }
    // Pending additions absorb edits into one Resource target (#181).
    await expect.poll(async () => (await notices())[0]?.data.resourceTitle).toBe('Última guía');
    expect(await notices()).toHaveLength(1);
    await expect(page.getByRole('link', { name: 'Última guía' })).toBeHidden();
    await expect(other.getByRole('button', { name: /Última guía/ })).toBeVisible();
    await expect(
      other.getByRole('button', { name: 'Avisos, 1 sin leer', exact: true }),
    ).toBeVisible();
    const [latest] = await notices();
    // Opening the Inbox leaves pending notices unchanged.
    expect(latest.id).toBe(first.id);
    expect(latest).toMatchObject({
      read: false,
      data: {
        eventCount: 1,
        resourceTitle: 'Última guía',
        noticeClass: 'roadmap-resource-changed',
      },
    });
    // The already-open Node did not recognize these subsequent arrivals.
    await other.getByRole('button', { name: /Última guía/ }).click();
    await expect(
      other.getByRole('dialog', { name: `Cambios en el Roadmap de ${course.courseCode}` }),
    ).toBeVisible();
    await other.getByRole('button', { name: 'Entendido' }).click();
    await other.locator(`.react-flow__node[data-id="${nodeId}"]`).click();
    await expect(other.getByRole('link', { name: 'Última guía' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Última guía' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Avisos', exact: true })).toBeVisible();
    await expect.poll(notices).toHaveLength(0);
  } finally {
    await student.close();
    await teacher.close();
  }
});

test('classification and Dependency repeats reconcile independent targets and preserve pending notices after access loss', async ({
  course,
  apiAs,
}) => {
  const teacher = await apiAs(course.users.teacher);
  const student = await apiAs(course.users.studentWithoutProgress);
  const revoked = await apiAs(course.users.studentComplete);
  const created = await teacher.post(course.apiPath('/node-types'), {
    data: { name: 'Lectura inicial', icon: 'BookOpen', color: '#024AD8' },
  });
  expect(created.status()).toBe(201);
  const typeId = (await created.json()).nodeType.id;
  const nodeId = await createExistingNode({
    roadmapId: course.roadmapId,
    nodeTypeId: typeId,
    title: 'Nodo de ruta',
  });
  expect(
    (await student.post(course.apiPath(`/nodes/${course.nodes.first}/completion`))).status(),
  ).toBe(200);
  const feed = async (client: typeof student) =>
    (await (await client.get(`/api/notifications?roadmapId=${course.roadmapId}&limit=100`)).json())
      .notifications;
  for (const name of ['Lectura', 'Guía', 'Material final']) {
    expect(
      (await teacher.patch(course.apiPath(`/node-types/${typeId}`), { data: { name } })).status(),
    ).toBe(200);
  }
  const connect = async () => {
    const response = await teacher.post(course.apiPath('/dependencies'), {
      data: { sourceNodeId: course.nodes.first, targetNodeId: nodeId },
    });
    expect(response.status()).toBe(201);
    return (await response.json()).dependency.id;
  };
  const firstDependency = await connect();
  expect((await teacher.delete(course.apiPath(`/dependencies/${firstDependency}`))).status()).toBe(
    204,
  );
  await connect();
  // Repeats reconcile one pending target per pair and Node type name (ADR-0014).
  await expect.poll(async () => (await feed(student)).length).toBe(2);
  const delivered = await feed(student);
  const byClass = (noticeClass: string) =>
    delivered.filter(
      (notice: { data: { noticeClass: string } }) => notice.data.noticeClass === noticeClass,
    );
  expect(byClass('roadmap-classification-changed')).toHaveLength(1);
  expect(byClass('roadmap-path-changed')).toHaveLength(1);
  expect(byClass('roadmap-classification-changed')[0]).toMatchObject({
    data: { eventCount: 1, nextTypeName: 'Material final', previousTypeName: 'Lectura inicial' },
  });
  expect(byClass('roadmap-path-changed')[0]).toMatchObject({
    data: {
      eventCount: 1,
      sourceNodeId: course.nodes.first,
      targetNodeId: nodeId,
      changeKind: 'dependency-added',
    },
  });
  expect(await feed(teacher)).toHaveLength(0);
  await sql(
    `UPDATE "Participation" SET "isActive" = false WHERE "courseOfferingId" = ${literal(course.id)} AND "userId" = ${literal(course.users.studentComplete.id)};`,
  );
  await expect.poll(() => feed(revoked)).toHaveLength(2);
  expect((await revoked.get(course.apiPath())).status()).toBe(403);
});
