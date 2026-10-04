import { expect, test } from './fixtures';
import { authenticateAs, sessionCookie } from './helpers';

test('Node repeats close without another edit or open Inbox, remain pending after an earlier opening and read as one summary', async ({
  request,
  page,
  course,
}) => {
  test.setTimeout(90_000);
  const author = { cookie: await sessionCookie(course.users.teacher.id) };
  const recipient = { cookie: await sessionCookie(course.users.studentWithoutProgress.id) };
  const roadmap = await (await request.get(course.apiPath(), { headers: author })).json();
  const title = `Resumen real ${crypto.randomUUID()}`;
  const created = await request.post(course.apiPath('/nodes'), {
    headers: author,
    data: { title, nodeTypeId: roadmap.nodeTypes[0].id, positionX: 600, positionY: 0 },
  });
  expect(created.status()).toBe(201);
  const nodeId = (await created.json()).node.id;
  const filter = `roadmapId=${roadmap.roadmap.id}&nodeId=${nodeId}`;
  const notices = async () => {
    const response = await request.get(`/api/notifications?${filter}`, { headers: recipient });
    expect(response.status()).toBe(200);
    return (await response.json()).notifications;
  };
  const count = async () =>
    (
      await (
        await request.get(`/api/notifications/counts?${filter}`, { headers: recipient })
      ).json()
    ).count;
  try {
    const first = (await notices())[0];
    expect(first).toMatchObject({
      subject: title,
      read: false,
      data: { eventCount: 1, changeKind: 'node-available' },
    });
    for (const description of ['Primer detalle', 'Último detalle'])
      expect(
        (
          await request.patch(course.apiPath(`/nodes/${nodeId}`), {
            headers: author,
            data: { description },
          })
        ).status(),
      ).toBe(200);
    expect(await notices()).toEqual([first]);
    const opening = { roadmapId: roadmap.roadmap.id, nodeId, operationId: crypto.randomUUID() };
    expect(
      (
        await request.post('/api/notifications/openings', { headers: recipient, data: opening })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post('/api/notifications/acknowledge', { headers: recipient, data: opening })
      ).status(),
    ).toBe(200);
    expect(await count()).toBe(0);

    // No browser/Inbox is open and no more mutations occur during the window.
    await expect
      .poll(async () => (await notices()).length, { timeout: 70_000, intervals: [1000] })
      .toBe(2);
    const [summary, retainedFirst] = await notices();
    expect(retainedFirst).toEqual({ ...first, read: true });
    expect(summary).toMatchObject({
      subject: `Resumen de cambios · Nodo «${title}»`,
      read: false,
      data: {
        eventCount: 2,
        actorName: course.users.teacher.name,
        changeKind: 'node-updated',
        changedFields: ['description'],
      },
    });
    expect(summary.body).toContain('Último cambio:');
    expect(new Date(summary.data.occurredAt).getTime()).toBeGreaterThanOrEqual(
      new Date(first.data.occurredAt).getTime(),
    );
    expect(await count()).toBe(1);
    // Retrying the earlier opening cannot absorb the newly published summary.
    expect(
      (
        await request.post('/api/notifications/acknowledge', { headers: recipient, data: opening })
      ).status(),
    ).toBe(200);
    expect(await count()).toBe(1);

    await authenticateAs(page.context(), course.users.studentWithoutProgress.id);
    await page.goto('/academic-overview');
    await page.getByRole('button', { name: /^Avisos(,|$)/ }).click();
    await page.getByRole('button', { name: new RegExp(`Resumen de cambios.*${title}`) }).click();
    await expect(page).toHaveURL(new RegExp(`targetNode=${nodeId}`));
    await expect(page.getByRole('dialog', { name: summary.subject, exact: true })).toBeVisible();
    await expect(page.getByText('2 cambios', { exact: true })).toBeVisible();
    await expect(page.getByText('Autor del último cambio', { exact: true })).toBeVisible();
    await expect(page.getByText('Último cambio', { exact: true })).toBeVisible();
    await expect.poll(count).toBe(0);
    expect((await notices()).filter((notice: { read: boolean }) => notice.read)).toHaveLength(2);
  } finally {
    await request.delete(course.apiPath(`/nodes/${nodeId}`), { headers: author });
  }
});
