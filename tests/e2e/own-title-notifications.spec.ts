import { expect, test } from './fixtures';
import { sessionCookie } from './helpers';

test('title target absorbs renames, withdraws a return to known and restarts after recognition', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const roadmap = await (await author.get(course.apiPath())).json();
  const node = roadmap.nodes.find((node: { id: string }) => node.id === course.nodes.first);
  const path = course.apiPath(`/nodes/${node.id}`);
  const notices = async () =>
    (await (await recipient.get(`/api/notifications?nodeId=${node.id}&read=false`)).json())
      .notifications;
  const rename = async (title: string) =>
    expect((await author.patch(path, { data: { title } })).status()).toBe(200);
  await rename('Recursividad');
  await expect.poll(notices).toHaveLength(1);
  const firstId = (await notices())[0].id;
  await rename('Recursividad avanzada');
  await expect
    .poll(async () => (await notices())[0]?.body)
    .toBe(`«${node.title}» pasó a llamarse «Recursividad avanzada».`);
  expect(await notices()).toMatchObject([{ id: firstId }]);
  expect(
    (await (await author.get(`/api/notifications?nodeId=${node.id}`)).json()).notifications,
  ).toHaveLength(0);
  await rename(node.title);
  await expect.poll(notices).toHaveLength(0);
  await rename('Pila');
  await expect.poll(notices).toHaveLength(1);
  const opening = {
    roadmapId: roadmap.roadmap.id,
    operationId: crypto.randomUUID(),
  };
  expect((await recipient.post('/api/notifications/openings', { data: opening })).status()).toBe(
    200,
  );
  expect((await recipient.post('/api/notifications/acknowledge', { data: opening })).status()).toBe(
    200,
  );
  await rename('Pilas');
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0].body).toBe('«Pila» pasó a llamarse «Pilas».');
});

test('concurrent title changes leave one target matching the current Node, and repeated saves do not duplicate it', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const path = course.apiPath(`/nodes/${course.nodes.first}`);
  const responses = await Promise.all(
    ['Primero', 'Segundo', 'Tercero'].map((title) => author.patch(path, { data: { title } })),
  );
  for (const response of responses) expect(response.status()).toBe(200);
  const roadmap = await (await author.get(course.apiPath())).json();
  const title = roadmap.nodes.find((node: { id: string }) => node.id === course.nodes.first).title;
  const notices = async () =>
    (
      await (
        await recipient.get(`/api/notifications?nodeId=${course.nodes.first}&read=false`)
      ).json()
    ).notifications;
  await expect.poll(notices).toHaveLength(1);
  await expect.poll(async () => (await notices())[0]?.data.currentTitle).toBe(title);
  expect((await author.patch(path, { data: { title } })).status()).toBe(200);
  expect(await notices()).toHaveLength(1);
});

test('updating and withdrawing a title target invalidate the recipient Inbox over real SSE', async ({
  course,
  apiAs,
}, testInfo) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const roadmap = await (await author.get(course.apiPath())).json();
  const node = roadmap.nodes.find((node: { id: string }) => node.id === course.nodes.first);
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
  const notices = async () =>
    (await (await recipient.get(`/api/notifications?nodeId=${node.id}&read=false`)).json())
      .notifications;
  try {
    await expect.poll(() => ready).toBe(true);
    for (const title of ['Primer nombre', 'Segundo nombre', node.title]) {
      const before = inboxEvents;
      expect(
        (await author.patch(course.apiPath(`/nodes/${node.id}`), { data: { title } })).status(),
      ).toBe(200);
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
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const path = course.apiPath(`/nodes/${course.nodes.first}`);
  const notices = async () =>
    (
      await (
        await recipient.get(`/api/notifications?nodeId=${course.nodes.first}&read=false`)
      ).json()
    ).notifications;
  const rename = async (title: string) =>
    expect((await author.patch(path, { data: { title } })).status()).toBe(200);
  await rename('Título reconocido');
  await expect.poll(notices).toHaveLength(1);
  const opening = {
    roadmapId: course.roadmapId,
    operationId: crypto.randomUUID(),
  };
  expect((await recipient.post('/api/notifications/openings', { data: opening })).status()).toBe(
    200,
  );
  await rename('Título posterior');
  await expect.poll(async () => (await notices())[0]?.data.currentTitle).toBe('Título posterior');
  expect((await recipient.post('/api/notifications/acknowledge', { data: opening })).status()).toBe(
    200,
  );
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0].body).toBe('«Título reconocido» pasó a llamarse «Título posterior».');
  expect((await recipient.post('/api/notifications/acknowledge', { data: opening })).status()).toBe(
    200,
  );
  expect(await notices()).toHaveLength(1);
  await rename('Título final');
  await expect
    .poll(async () => (await notices())[0]?.body)
    .toBe('«Título reconocido» pasó a llamarse «Título final».');
});
