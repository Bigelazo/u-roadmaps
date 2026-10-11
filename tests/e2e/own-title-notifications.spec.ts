import { expect, test } from './fixtures';
import { ok, sessionCookie } from './helpers';
import {
  acknowledgeOpening,
  findNode,
  listNotices,
  pendingNotices,
  prepareOpening,
  recognize,
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
}, testInfo) => {
  const node = findNode(await (await author.get(course.apiPath())).json(), course.nodes.first);
  const stop = new AbortController();
  const response = await fetch(`${testInfo.project.use.baseURL}/api/notifications/stream`, {
    headers: { cookie: await sessionCookie(course.users.studentWithoutProgress.id) },
    signal: stop.signal,
  });
  expect(response.status).toBe(200);
  let ready = false;
  let inboxEvents = 0;
  const reader = response.body!.getReader();
  const listen = (async () => {
    let buffer = '';
    const decoder = new TextDecoder();
    while (!stop.signal.aborted) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const event = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        if (event.startsWith('event: ready')) ready = true;
        if (event.startsWith('event: inbox')) inboxEvents += 1;
      }
    }
  })();
  // Attach rejection handling immediately; aborting fetch closes the reader.
  const settled = listen.catch((error: Error) => {
    if (!stop.signal.aborted) throw error;
  });
  const notices = () => pendingNotices(recipient, node.id);
  try {
    await expect.poll(() => ready).toBe(true);
    for (const title of ['Primer nombre', 'Segundo nombre', node.title]) {
      const before = inboxEvents;
      await ok(await author.patch(course.apiPath(`/nodes/${node.id}`), { data: { title } }));
      await expect.poll(() => inboxEvents).toBeGreaterThan(before);
      await expect.poll(notices).toHaveLength(title === node.title ? 0 : 1);
      expect(
        (await (await recipient.get(`/api/notifications/counts?nodeId=${node.id}`)).json()).count,
      ).toBe(title === node.title ? 0 : 1);
    }
  } finally {
    stop.abort();
    await settled;
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
