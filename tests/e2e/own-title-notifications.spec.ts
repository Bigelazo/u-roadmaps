import { expect, test } from './fixtures';
import { authenticateAs, ok } from './helpers';
import {
  acknowledgeOpening,
  findNode,
  listNotices,
  openNativeStream,
  pendingNotices,
  prepareOpening,
  recognize,
  streamFrames,
} from './notices';

test('title target absorbs renames, withdraws a return to known and restarts after recognition', async ({
  course,
  teacherApi: author,
  studentApi: recipient,
}) => {
  const roadmap = await (await author.get(course.apiPath())).json();
  const node = findNode(roadmap, course.nodes.first);
  const path = course.apiPath(`/nodes/${node.id}`);
  const notices = () => pendingNotices(recipient, node.id);
  const rename = async (title: string) => ok(await author.patch(path, { data: { title } }));
  await rename('Recursividad');
  await expect.poll(notices).toHaveLength(1);
  const firstId = (await notices())[0].id;
  await rename('Recursividad avanzada');
  await expect
    .poll(async () => (await notices())[0]?.body)
    .toBe(`«${node.title}» pasó a llamarse «Recursividad avanzada».`);
  expect(await notices()).toMatchObject([{ id: firstId }]);
  expect(await listNotices(author, { nodeId: node.id })).toHaveLength(0);
  await rename(node.title);
  await expect.poll(notices).toHaveLength(0);
  await rename('Pila');
  await expect.poll(notices).toHaveLength(1);
  await recognize(recipient, roadmap.roadmap.id);
  await rename('Pilas');
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0].body).toBe('«Pila» pasó a llamarse «Pilas».');
});

test('concurrent title changes leave one target matching the current Node, and repeated saves do not duplicate it', async ({
  course,
  teacherApi: author,
  studentApi: recipient,
}) => {
  const path = course.apiPath(`/nodes/${course.nodes.first}`);
  const responses = await Promise.all(
    ['Primero', 'Segundo', 'Tercero'].map((title) => author.patch(path, { data: { title } })),
  );
  for (const response of responses) await ok(response);
  const roadmap = await (await author.get(course.apiPath())).json();
  const { title } = findNode(roadmap, course.nodes.first);
  const notices = () => pendingNotices(recipient, course.nodes.first);
  await expect.poll(notices).toHaveLength(1);
  await expect.poll(async () => (await notices())[0]?.data.currentTitle).toBe(title);
  await ok(await author.patch(path, { data: { title } }));
  expect(await notices()).toHaveLength(1);
});

test('updating and withdrawing a title target invalidate the recipient Inbox over real SSE', async ({
  course,
  teacherApi: author,
  studentApi: recipient,
  page,
}) => {
  const node = findNode(await (await author.get(course.apiPath())).json(), course.nodes.first);
  await authenticateAs(page.context(), course.users.studentWithoutProgress.id);
  await openNativeStream(page);
  const inboxEvents = async () =>
    (await streamFrames(page)).filter((frame) => frame.kind === 'inbox').length;
  const notices = () => pendingNotices(recipient, node.id);
  for (const title of ['Primer nombre', 'Segundo nombre', node.title]) {
    const before = await inboxEvents();
    await ok(await author.patch(course.apiPath(`/nodes/${node.id}`), { data: { title } }));
    await expect.poll(inboxEvents).toBeGreaterThan(before);
    await expect.poll(notices).toHaveLength(title === node.title ? 0 : 1);
    expect(
      (await (await recipient.get(`/api/notifications/counts?nodeId=${node.id}`)).json()).count,
    ).toBe(title === node.title ? 0 : 1);
  }
});

test('recognition preserves title changes delivered after its opening snapshot, including retries', async ({
  course,
  teacherApi: author,
  studentApi: recipient,
}) => {
  const path = course.apiPath(`/nodes/${course.nodes.first}`);
  const notices = () => pendingNotices(recipient, course.nodes.first);
  const rename = async (title: string) => ok(await author.patch(path, { data: { title } }));
  await rename('Título reconocido');
  await expect.poll(notices).toHaveLength(1);
  const opening = await prepareOpening(recipient, course.roadmapId);
  await rename('Título posterior');
  await expect.poll(async () => (await notices())[0]?.data.currentTitle).toBe('Título posterior');
  await acknowledgeOpening(recipient, opening);
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0].body).toBe('«Título reconocido» pasó a llamarse «Título posterior».');
  await acknowledgeOpening(recipient, opening);
  expect(await notices()).toHaveLength(1);
  await rename('Título final');
  await expect
    .poll(async () => (await notices())[0]?.body)
    .toBe('«Título reconocido» pasó a llamarse «Título final».');
});

test('an actor’s own rename advances their Known title, so a colleague’s revert reaches them', async ({
  course,
  apiAs,
}) => {
  const teacherA = await apiAs(course.users.teacher);
  const teacherB = await apiAs(course.users.teachingAssistant);
  const roadmap = await (await teacherA.get(course.apiPath())).json();
  const node = findNode(roadmap, course.nodes.first);
  const path = course.apiPath(`/nodes/${node.id}`);
  await recognize(teacherA, roadmap.roadmap.id);
  const notices = () => pendingNotices(teacherA, node.id);
  await ok(await teacherA.patch(path, { data: { title: 'Pilas y colas' } }));
  expect(await notices()).toHaveLength(0);
  await ok(await teacherB.patch(path, { data: { title: node.title } }));
  await expect
    .poll(async () => (await notices())[0]?.body)
    .toBe(`«Pilas y colas» pasó a llamarse «${node.title}».`);
  expect(await notices()).toHaveLength(1);
});
