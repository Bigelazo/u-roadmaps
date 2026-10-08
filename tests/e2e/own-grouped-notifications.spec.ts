import { expect, test } from './fixtures';
import { authenticateAs } from './helpers';

test('Inbox groups three targets, counts edits as targets, and ungroups on withdrawal', async ({
  course,
  apiAs,
  page,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const roadmap = await (await author.get(course.apiPath())).json();
  const nodes = roadmap.nodes.filter((node: { isVisible: boolean }) => node.isVisible).slice(0, 3);
  expect(nodes).toHaveLength(3);
  const notices = async () =>
    (
      await (
        await recipient.get(`/api/notifications?groupBy=roadmapId&roadmapId=${course.roadmapId}`)
      ).json()
    ).notifications;
  await authenticateAs(page.context(), course.users.studentWithoutProgress.id);
  // Enter before edits so the canvas can display arriving counts without recognition.
  const recognized = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/notifications/acknowledge') && response.status() === 200,
  );
  await page.goto(course.pagePath());
  await recognized;
  for (let edit = 0; edit < 4; edit++) {
    for (const node of nodes) {
      expect(
        (
          await author.patch(course.apiPath(`/nodes/${node.id}`), {
            data: { title: `${node.title} ${edit}` },
          })
        ).status(),
      ).toBe(200);
    }
  }
  await expect.poll(notices).toMatchObject([
    {
      courseName: course.courseName,
      body: 'El Roadmap ha recibido 3 cambios.',
      data: { targetCount: 3, changeKind: 'roadmap-grouped' },
    },
  ]);
  expect(await notices()).toHaveLength(1);
  for (const filter of [
    '',
    `roadmapId=${course.roadmapId}`,
    `courseCode=${course.courseCode}&year=${course.year}&semester=${course.semester}`,
  ]) {
    expect((await (await recipient.get(`/api/notifications/counts?${filter}`)).json()).count).toBe(
      3,
    );
  }
  await expect(page.getByRole('button', { name: 'Avisos, 3 sin leer', exact: true })).toBeVisible();
  // The global bell is the only Inbox counter inside the canvas.
  await expect(page.getByRole('button', { name: /avisos sin leer para este Roadmap/ })).toHaveCount(
    0,
  );
  await page.goto('/academic-overview');
  await expect(
    page.getByRole('button', {
      name: `3 avisos sin leer para el curso ${course.courseName}`,
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Avisos, 3 sin leer', exact: true }).click();
  const row = page.getByRole('button', { name: /El Roadmap ha recibido 3 cambios\./ });
  await expect(row).toContainText(course.courseName);
  await row.click();
  await expect(page).toHaveURL(course.pagePath());
  await expect.poll(notices).toHaveLength(0);
  // A fresh set of pending targets crosses back below the threshold.
  for (const node of nodes) {
    expect(
      (
        await author.patch(course.apiPath(`/nodes/${node.id}`), {
          data: { title: `${node.title} final` },
        })
      ).status(),
    ).toBe(200);
  }
  await expect.poll(notices).toHaveLength(1);
  expect(
    (
      await author.patch(course.apiPath(`/nodes/${nodes[0].id}`), {
        data: { title: `${nodes[0].title} 3` },
      })
    ).status(),
  ).toBe(200);
  await expect.poll(notices).toHaveLength(2);
  expect(
    (await (await recipient.get(`/api/notifications/counts?roadmapId=${course.roadmapId}`)).json())
      .count,
  ).toBe(2);
});

test('Roadmaps group separately before pagination and absorbed targets move to the top', async ({
  course,
  createCourse,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const second = await createCourse({
    participants: [
      { user: course.users.teacher, role: 'TEACHER' },
      { user: course.users.studentWithoutProgress, role: 'STUDENT' },
    ],
  });
  const firstRoadmap = await (await author.get(course.apiPath())).json();
  const firstNodes = firstRoadmap.nodes
    .filter((node: { isVisible: boolean }) => node.isVisible)
    .slice(0, 3);
  const secondRoadmap = await (await author.get(second.apiPath())).json();
  for (const title of ['Segundo A', 'Segundo B']) {
    const response = await author.post(second.apiPath('/nodes'), {
      data: {
        title,
        nodeTypeId: secondRoadmap.nodeTypes[0].id,
        positionX: 0,
        positionY: 0,
        isVisible: true,
      },
    });
    expect(response.status()).toBe(201);
  }
  const list = async (query = '') =>
    await (await recipient.get(`/api/notifications?groupBy=roadmapId&${query}`)).json();
  for (const node of firstNodes.slice(0, 2)) {
    expect(
      (
        await author.patch(course.apiPath(`/nodes/${node.id}`), {
          data: { title: `${node.title} nuevo` },
        })
      ).status(),
    ).toBe(200);
  }
  await expect.poll(async () => (await list()).notifications.length).toBe(4);
  const before = (await list()).notifications.find(
    (row: { data: { nodeId: string } }) => row.data.nodeId === firstNodes[0].id,
  );
  expect(
    (
      await author.patch(course.apiPath(`/nodes/${firstNodes[0].id}`), {
        data: { title: 'Cambio más reciente' },
      })
    ).status(),
  ).toBe(200);
  await expect
    .poll(async () => (await list()).notifications[0]?.body)
    .toContain('Cambio más reciente');
  const updated = (await list()).notifications[0];
  expect(updated.id).toBe(before.id);
  expect(Date.parse(updated.createdAt)).toBeGreaterThan(Date.parse(before.createdAt));
  expect(updated.data.occurredAt).toBe(updated.createdAt);
  expect(
    (
      await author.patch(course.apiPath(`/nodes/${firstNodes[2].id}`), {
        data: { title: 'Tercer objeto' },
      })
    ).status(),
  ).toBe(200);
  await expect.poll(async () => (await list()).notifications.length).toBe(3);
  const firstPage = await list('limit=1');
  expect(firstPage.notifications).toMatchObject([
    { data: { roadmapId: course.roadmapId, targetCount: 3 } },
  ]);
  expect(firstPage.hasMore).toBe(true);
  const next = await list(`limit=10&after=${firstPage.notifications[0].id}`);
  expect(next.notifications).toHaveLength(2);
  expect(next.hasMore).toBe(false);
  expect(
    next.notifications.every(
      (row: { data: { roadmapId: string } }) => row.data.roadmapId === second.roadmapId,
    ),
  ).toBe(true);
});
