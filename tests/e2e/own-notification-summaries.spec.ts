import { expect, test } from './fixtures';
import { authenticateAs, sessionCookie } from './helpers';

test('Node repeats arrive without an open Inbox and an earlier opening cannot acknowledge later changes', async ({
  request,
  page,
  course,
}) => {
  const author = { cookie: await sessionCookie(course.users.teacher.id) };
  const recipient = { cookie: await sessionCookie(course.users.studentWithoutProgress.id) };
  const roadmap = await (await request.get(course.apiPath(), { headers: author })).json();
  const title = `Cambios propios ${crypto.randomUUID()}`;
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
    await expect.poll(notices).toHaveLength(1);
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
    await expect.poll(notices).toHaveLength(2);
    const repeated = await notices();
    expect(repeated).toHaveLength(2);
    expect(repeated[1]).toEqual(first);
    expect(repeated.slice(0, 1)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          read: false,
          data: expect.objectContaining({
            eventCount: 1,
            changedFields: ['description'],
            noticeTarget: 'node-description',
            currentValue: '"Último detalle"',
          }),
        }),
      ]),
    );
    const opening = { roadmapId: roadmap.roadmap.id, operationId: crypto.randomUUID() };
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

    // No browser/Inbox is open; a later edit is delivered immediately.
    const laterTitle = `${title} actualizado`;
    expect(
      (
        await request.patch(course.apiPath(`/nodes/${nodeId}`), {
          headers: author,
          data: { title: laterTitle },
        })
      ).status(),
    ).toBe(200);
    await expect.poll(notices).toHaveLength(1);
    const [latest] = await notices();
    expect(latest).toMatchObject({
      subject: laterTitle,
      read: false,
      data: {
        eventCount: 1,
        actorName: course.users.teacher.name,
        changeKind: 'node-updated',
        changedFields: ['title'],
      },
    });
    expect(new Date(latest.data.occurredAt).getTime()).toBeGreaterThanOrEqual(
      new Date(first.data.occurredAt).getTime(),
    );
    await expect.poll(() => count()).toBe(1);
    // Retrying the earlier opening cannot absorb the later notice.
    expect(
      (
        await request.post('/api/notifications/acknowledge', { headers: recipient, data: opening })
      ).status(),
    ).toBe(200);
    await expect.poll(() => count()).toBe(1);

    await authenticateAs(page.context(), course.users.studentWithoutProgress.id);
    await page.goto('/academic-overview');
    await page.getByRole('button', { name: /^Avisos(,|$)/ }).click();
    await page.getByRole('button', { name: new RegExp(laterTitle) }).click();
    await expect(page).toHaveURL(course.pagePath());
    await expect(
      page.getByRole('dialog', { name: `Cambios en el Roadmap de ${course.courseCode}` }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Entendido' }).click();
    await page.locator(`.react-flow__node[data-id="${nodeId}"]`).click();
    await expect(page.getByText('Último detalle', { exact: true })).toBeVisible();
    await expect.poll(count).toBe(0);
    expect(await notices()).toHaveLength(0);
  } finally {
    await request.delete(course.apiPath(`/nodes/${nodeId}`), { headers: author });
  }
});
