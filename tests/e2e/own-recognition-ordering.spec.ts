import { randomUUID } from 'node:crypto';
import { expect, test } from './fixtures';
import { prepareNodeCreator } from './create-node';

// Two server-captured entries emulate tabs whose acknowledgement requests arrive
// in reverse order, without relying on browser timing or mocked notice delivery.
test('an older Roadmap entry cannot undo knowledge recognized by a newer entry', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const nodeId = course.nodes.first;
  const notices = async () =>
    (await (await recipient.get(`/api/notifications?nodeId=${nodeId}`)).json()).notifications;
  const rename = async (title: string) => {
    expect(
      (await author.patch(course.apiPath(`/nodes/${nodeId}`), { data: { title } })).status(),
    ).toBe(200);
    await expect.poll(async () => (await notices())[0]?.data.currentTitle).toBe(title);
  };
  const prepare = async () => {
    const opening = { roadmapId: course.roadmapId, operationId: randomUUID() };
    expect((await recipient.post('/api/notifications/openings', { data: opening })).status()).toBe(
      200,
    );
    return opening;
  };
  const recognize = async (opening: { roadmapId: string; operationId: string }) => {
    const response = await recipient.post('/api/notifications/acknowledge', { data: opening });
    expect(response.status()).toBe(200);
    return response.json();
  };
  await rename('Título de la entrada antigua');
  const older = await prepare();
  await rename('Título de la entrada nueva');
  const newer = await prepare();
  await recognize(newer);
  expect(await notices()).toHaveLength(0);
  expect(await recognize(older)).toMatchObject({ acknowledged: 0, summary: null });
  expect(await notices()).toHaveLength(0);
  expect(await recognize(older)).toMatchObject({ acknowledged: 0, summary: null });
  await rename('Título después de ambas entradas');
  expect((await notices())[0].body).toBe(
    '«Título de la entrada nueva» pasó a llamarse «Título después de ambas entradas».',
  );
});

test('older absorbed Node creation snapshots cannot roll back newer recognized content', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const creator = await prepareNodeCreator(author, course);
  const node = await creator.createNode('Nodo de la entrada antigua', 700);
  const notices = async () =>
    (await (await recipient.get(`/api/notifications?nodeId=${node.id}`)).json()).notifications;
  await expect.poll(notices).toHaveLength(1);
  const older = { roadmapId: course.roadmapId, operationId: randomUUID() };
  expect((await recipient.post('/api/notifications/openings', { data: older })).status()).toBe(200);
  expect(
    (
      await author.patch(course.apiPath(`/nodes/${node.id}`), {
        data: { title: 'Nodo de la entrada nueva', description: 'Descripción reconocida nueva' },
      })
    ).status(),
  ).toBe(200);
  // The HTTP editor commits the content before prepare captures the broad snapshot.
  const newer = { roadmapId: course.roadmapId, operationId: randomUUID() };
  expect((await recipient.post('/api/notifications/openings', { data: newer })).status()).toBe(200);
  expect((await recipient.post('/api/notifications/acknowledge', { data: newer })).status()).toBe(
    200,
  );
  expect((await recipient.post('/api/notifications/acknowledge', { data: older })).status()).toBe(
    200,
  );
  expect(await notices()).toHaveLength(0);
  expect(
    (
      await author.patch(course.apiPath(`/nodes/${node.id}`), {
        data: { title: 'Nodo posterior' },
      })
    ).status(),
  ).toBe(200);
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0].body).toBe(
    '«Nodo de la entrada nueva» pasó a llamarse «Nodo posterior».',
  );
});

test('a later empty entry recognizes restored content after an older entry acknowledgement', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const roadmap = await (await author.get(course.apiPath())).json();
  const node = roadmap.nodes.find((item: { id: string }) => item.id === course.nodes.first);
  const notices = async () =>
    (await (await recipient.get(`/api/notifications?nodeId=${node.id}`)).json()).notifications;
  const edit = async (title: string) => {
    expect(
      (await author.patch(course.apiPath(`/nodes/${node.id}`), { data: { title } })).status(),
    ).toBe(200);
  };
  const prepare = async () => {
    const opening = { roadmapId: course.roadmapId, operationId: randomUUID() };
    expect((await recipient.post('/api/notifications/openings', { data: opening })).status()).toBe(
      200,
    );
    return opening;
  };
  const recognize = async (opening: { roadmapId: string; operationId: string }) => {
    const response = await recipient.post('/api/notifications/acknowledge', { data: opening });
    expect(response.status()).toBe(200);
  };
  await edit('Título capturado por la entrada antigua');
  await expect.poll(notices).toHaveLength(1);
  const older = await prepare();
  await edit(node.title);
  await expect.poll(notices).toHaveLength(0);
  const restored = await prepare();
  await recognize(older);
  await expect.poll(notices).toHaveLength(1);
  await recognize(restored);
  expect(await notices()).toHaveLength(0);
  await edit('Título después de la restauración');
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0].body).toBe(
    `«${node.title}» pasó a llamarse «Título después de la restauración».`,
  );
});

test('a newer entry recognizes Node absence after an older entry recreates its deletion notice', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const nodeId = course.nodes.first;
  const notices = async () =>
    (await (await recipient.get(`/api/notifications?nodeId=${nodeId}`)).json()).notifications;
  // Establish lifecycle knowledge independently of later deletion delivery.
  const initial = { roadmapId: course.roadmapId, operationId: randomUUID() };
  expect((await recipient.post('/api/notifications/openings', { data: initial })).status()).toBe(
    200,
  );
  expect((await recipient.post('/api/notifications/acknowledge', { data: initial })).status()).toBe(
    200,
  );
  const older = { roadmapId: course.roadmapId, operationId: randomUUID() };
  expect((await recipient.post('/api/notifications/openings', { data: older })).status()).toBe(200);
  expect((await author.delete(course.apiPath(`/nodes/${nodeId}`))).status()).toBe(204);
  await expect.poll(notices).toHaveLength(1);
  const newer = { roadmapId: course.roadmapId, operationId: randomUUID() };
  expect((await recipient.post('/api/notifications/openings', { data: newer })).status()).toBe(200);
  expect((await recipient.post('/api/notifications/acknowledge', { data: older })).status()).toBe(
    200,
  );
  await expect.poll(notices).toHaveLength(1);
  expect((await recipient.post('/api/notifications/acknowledge', { data: newer })).status()).toBe(
    200,
  );
  expect(await notices()).toHaveLength(0);
});

test('recognizing an ordinary entry does not notify an author about their own later edit', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const opening = { roadmapId: course.roadmapId, operationId: randomUUID() };
  expect((await author.post('/api/notifications/openings', { data: opening })).status()).toBe(200);
  expect(
    (
      await author.patch(course.apiPath(`/nodes/${course.nodes.first}`), {
        data: { title: 'Cambio propio después de preparar la entrada' },
      })
    ).status(),
  ).toBe(200);
  expect((await author.post('/api/notifications/acknowledge', { data: opening })).status()).toBe(
    200,
  );
  const inbox = await author.get(`/api/notifications?roadmapId=${course.roadmapId}`);
  expect(inbox.status()).toBe(200);
  expect((await inbox.json()).notifications).toHaveLength(0);
});
