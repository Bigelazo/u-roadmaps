import { randomUUID } from 'node:crypto';
import { expect, test } from './fixtures';
import { insert, sql } from './database';
import { authenticateAs } from './helpers';

test('one grouped canvas request supplies Node badges and isolates recipients', async ({
  page,
  course,
  apiAs,
  createUser,
}) => {
  const user = course.users.studentWithProgress;
  const nodeIds = [course.nodes.first, course.nodes.first, course.nodes.second, null];
  await authenticateAs(page.context(), user.id);
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/notifications/counts')) requests.push(request.url());
  });
  await page.addInitScript(() => {
    (window as unknown as Window & { inboxRefreshes: number }).inboxRefreshes = 0;
    window.addEventListener('own-inbox-updated', () => {
      (window as unknown as Window & { inboxRefreshes: number }).inboxRefreshes++;
    });
  });
  const acknowledged = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/notifications/acknowledge') &&
      response.request().method() === 'POST',
  );
  await page.goto(course.pagePath());
  expect((await acknowledged).status()).toBe(200);
  await expect(page.getByRole('heading', { name: course.courseName })).toBeVisible();
  const api = await apiAs(user);
  // Entering recognizes existing notices. Seed arrivals only after opening completes.
  await expect
    .poll(
      async () =>
        (await (await api.get(`/api/notifications/counts?roadmapId=${course.roadmapId}`)).json())
          .count,
    )
    .toBe(0);
  const groupedRequests = () => requests.filter((url) => url.includes('groupBy=nodeId')).length;
  const refreshes = () =>
    page.evaluate(() => (window as unknown as Window & { inboxRefreshes: number }).inboxRefreshes);
  const baseline = { refreshes: await refreshes(), requests: groupedRequests() };
  expect(baseline.requests).toBeGreaterThan(0);
  await sql(
    insert(
      'RoadmapNotice',
      nodeIds.map((nodeId) => ({
        id: randomUUID(),
        eventId: randomUUID(),
        recipientId: user.id,
        roadmapId: course.roadmapId,
        courseOfferingId: course.id,
        subject: 'Conteo agrupado',
        body: 'Aviso de prueba',
        data: JSON.stringify({ nodeId, roadmapId: course.roadmapId }),
        occurredAt: new Date(),
      })),
    ),
  );
  const groupedUrl = `/api/notifications/counts?roadmapId=${course.roadmapId}&groupBy=nodeId`;
  expect(await (await api.get(groupedUrl)).json()).toEqual({
    count: 4,
    byNode: { [course.nodes.first]: 2, [course.nodes.second]: 1 },
  });
  const outsider = await apiAs(await createUser());
  expect(await (await outsider.get(groupedUrl)).json()).toEqual({ count: 0, byNode: {} });
  expect(
    (await api.get('/api/notifications/counts?roadmapId=invalid&groupBy=nodeId')).status(),
  ).toBe(400);
  const author = await apiAs(course.users.teacher);
  expect(
    (
      await author.patch(course.apiPath(`/nodes/${course.nodes.first}`), {
        data: { description: 'Cambio posterior a la entrada' },
      })
    ).status(),
  ).toBe(200);
  const first = page.getByRole('button', { name: '3 avisos sin leer para este Nodo' });
  await expect(first).toBeVisible();
  await expect(
    page.getByRole('button', { name: '1 avisos sin leer para este Nodo' }),
  ).toBeVisible();
  await expect
    .poll(
      async () =>
        groupedRequests() - baseline.requests - ((await refreshes()) - baseline.refreshes),
    )
    .toBe(0);
  expect(groupedRequests()).toBeGreaterThan(baseline.requests);
  expect(requests.filter((url) => new URL(url).searchParams.has('nodeId'))).toHaveLength(0);
  await first.click();
  await expect(page.getByRole('button', { name: /Conteo agrupado/ })).toHaveCount(2);
});
