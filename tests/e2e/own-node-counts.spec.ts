import { expect, test } from './fixtures';
import { authenticateAs } from './helpers';

test('Node marks outlive Roadmap recognition and clear only when that Node is opened', async ({
  page,
  course,
  apiAs,
  createUser,
}) => {
  const user = course.users.studentWithProgress;
  const author = await apiAs(course.users.teacher);
  const api = await apiAs(user);
  const roadmap = await (await author.get(course.apiPath())).json();
  const titleOf = (id: string) =>
    roadmap.nodes.find((node: { id: string; title: string }) => node.id === id).title as string;
  const card = (id: string) => page.getByTestId('roadmap-card').filter({ hasText: titleOf(id) });
  const mark = (id: string) => card(id).getByRole('img', { name: /cambios? sin revisar/ });
  const changesUrl = `/api/notifications/node-changes?roadmapId=${course.roadmapId}`;
  const changes = async () => (await (await api.get(changesUrl)).json()).byNode;
  const pending = async () =>
    (await (await api.get(`/api/notifications/counts?roadmapId=${course.roadmapId}`)).json()).count;
  await authenticateAs(page.context(), user.id);
  const entered = () =>
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/notifications/acknowledge') &&
        response.request().method() === 'POST',
    );
  let acknowledged = entered();
  await page.goto(course.pagePath());
  expect((await acknowledged).status()).toBe(200);

  for (const description of ['Primera revisión', 'Segunda revisión']) {
    const response = await author.patch(course.apiPath(`/nodes/${course.nodes.first}`), {
      data: { description },
    });
    expect(response.status()).toBe(200);
  }
  // Repeated edits to one object count once, and the mark arrives live.
  await expect(mark(course.nodes.first)).toHaveAccessibleName('1 cambio sin revisar');
  await expect(mark(course.nodes.first)).toHaveText('1');
  expect(await changes()).toEqual({ [course.nodes.first]: 1 });
  await expect(mark(course.nodes.second)).toHaveCount(0);
  // The canvas no longer repeats the global bell.
  await expect(page.getByRole('button', { name: /avisos sin leer para este Roadmap/ })).toHaveCount(
    0,
  );

  acknowledged = entered();
  await page.reload();
  expect((await acknowledged).status()).toBe(200);
  await page.getByRole('button', { name: 'Entendido' }).click();
  // Entering empties the Inbox, but the Node keeps its mark until it is reviewed.
  await expect.poll(pending).toBe(0);
  await expect(mark(course.nodes.first)).toHaveText('1');

  await card(course.nodes.first).click();
  await expect(mark(course.nodes.first)).toHaveCount(0);
  await expect.poll(changes).toEqual({});

  // A later change marks the Node again, without reopening the reviewed one.
  expect(
    (
      await author.patch(course.apiPath(`/nodes/${course.nodes.first}`), {
        data: { description: 'Tercera revisión' },
      })
    ).status(),
  ).toBe(200);
  await expect.poll(changes).toEqual({ [course.nodes.first]: 1 });

  const outsider = await apiAs(await createUser());
  expect(await (await outsider.get(changesUrl)).json()).toEqual({ byNode: {} });
  expect(
    (
      await outsider.post('/api/notifications/node-changes', {
        data: { roadmapId: course.roadmapId, nodeId: course.nodes.first },
      })
    ).status(),
  ).toBe(403);
  expect((await api.get('/api/notifications/node-changes?roadmapId=invalid')).status()).toBe(400);
});
