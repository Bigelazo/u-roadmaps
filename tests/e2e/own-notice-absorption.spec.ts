import { expect, test } from './fixtures';
import { authenticateAs, ok } from './helpers';
import { acknowledgeOpening, listNotices, prepareOpening } from './notices';
import { deleteNode } from './previewed-writes';

test('Node repeats arrive without an open Inbox and an earlier opening cannot acknowledge later changes', async ({
  page,
  course,
  teacherApi: author,
  studentApi: recipient,
}) => {
  const roadmap = await (await author.get(course.apiPath())).json();
  const title = `Cambios propios ${crypto.randomUUID()}`;
  const created = await author.post(course.apiPath('/nodes'), {
    data: { title, nodeTypeId: roadmap.nodeTypes[0].id, positionX: 600, positionY: 0 },
  });
  const nodeId = (await (await ok(created, 201)).json()).node.id;
  const filter = `roadmapId=${roadmap.roadmap.id}&nodeId=${nodeId}`;
  const notices = () => listNotices(recipient, { roadmapId: roadmap.roadmap.id, nodeId });
  const count = async () =>
    (await (await recipient.get(`/api/notifications/counts?${filter}`)).json()).count;
  try {
    await expect.poll(notices).toHaveLength(1);
    const first = (await notices())[0];
    expect(first).toMatchObject({
      subject: `Nuevo Nodo «${title}»`,
      read: false,
      data: { eventCount: 1, noticeTarget: 'node-creation' },
    });
    for (const description of ['Primer detalle', 'Último detalle'])
      await ok(await author.patch(course.apiPath(`/nodes/${nodeId}`), { data: { description } }));
    await expect
      .poll(async () => (await notices())[0]?.data.nodeDescription)
      .toBe('Último detalle');
    const repeated = await notices();
    expect(repeated).toHaveLength(1);
    expect(repeated[0]).toMatchObject({
      id: first.id,
      subject: first.subject,
      read: false,
      data: { noticeTarget: 'node-creation', nodeDescription: 'Último detalle' },
    });
    const opening = await prepareOpening(recipient, roadmap.roadmap.id);
    await acknowledgeOpening(recipient, opening);
    expect(await count()).toBe(0);

    const laterTitle = `${title} actualizado`;
    await ok(
      await author.patch(course.apiPath(`/nodes/${nodeId}`), { data: { title: laterTitle } }),
    );
    await expect.poll(notices).toHaveLength(1);
    const [latest] = await notices();
    expect(latest).toMatchObject({
      subject: laterTitle,
      read: false,
      data: {
        eventCount: 1,
        actorName: course.users.teacher.name,
        noticeTarget: 'node-title',
      },
    });
    expect(new Date(latest.data.occurredAt).getTime()).toBeGreaterThanOrEqual(
      new Date(first.data.occurredAt).getTime(),
    );
    await expect.poll(() => count()).toBe(1);
    await acknowledgeOpening(recipient, opening);
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
    await deleteNode(author, course.apiPath(`/nodes/${nodeId}`));
  }
});
