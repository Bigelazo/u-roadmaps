import { expect, test } from './fixtures';
import { prepareNodeCreator } from './create-node';
import { ok } from './helpers';
import {
  acknowledgeOpening,
  findNode,
  listNotices,
  prepareOpening,
  recognize,
  type RoadmapOpening,
} from './notices';
import { deleteNode } from './previewed-writes';

// Two server-captured entries emulate tabs whose acknowledgement requests arrive
// in reverse order, without relying on browser timing or mocked notice delivery.
test('an older Roadmap entry cannot undo knowledge recognized by a newer entry', async ({
  course,
  teacherApi: author,
  studentApi: recipient,
}) => {
  const nodeId = course.nodes.first;
  const notices = () => listNotices(recipient, { nodeId });
  const rename = async (title: string) => {
    await ok(await author.patch(course.apiPath(`/nodes/${nodeId}`), { data: { title } }));
    await expect.poll(async () => (await notices())[0]?.data.currentTitle).toBe(title);
  };
  // This test asserts the acknowledgement summary, so it reads the response body.
  const acknowledge = async (opening: RoadmapOpening) =>
    (await ok(await recipient.post('/api/notifications/acknowledge', { data: opening }))).json();
  await rename('Título de la entrada antigua');
  const older = await prepareOpening(recipient, course.roadmapId);
  await rename('Título de la entrada nueva');
  const newer = await prepareOpening(recipient, course.roadmapId);
  await acknowledge(newer);
  expect(await notices()).toHaveLength(0);
  expect(await acknowledge(older)).toMatchObject({ acknowledged: 0, summary: null });
  expect(await notices()).toHaveLength(0);
  expect(await acknowledge(older)).toMatchObject({ acknowledged: 0, summary: null });
  await rename('Título después de ambas entradas');
  expect((await notices())[0].body).toBe(
    '«Título de la entrada nueva» pasó a llamarse «Título después de ambas entradas».',
  );
});

test('older absorbed Node creation snapshots cannot roll back newer recognized content', async ({
  course,
  teacherApi: author,
  studentApi: recipient,
}) => {
  const creator = await prepareNodeCreator(author, course);
  const node = await creator.createNode('Nodo de la entrada antigua', 700);
  const notices = () => listNotices(recipient, { nodeId: node.id });
  await expect.poll(notices).toHaveLength(1);
  const older = await prepareOpening(recipient, course.roadmapId);
  await ok(
    await author.patch(course.apiPath(`/nodes/${node.id}`), {
      data: { title: 'Nodo de la entrada nueva', description: 'Descripción reconocida nueva' },
    }),
  );
  // The HTTP editor commits the content before prepare captures the broad snapshot.
  const newer = await prepareOpening(recipient, course.roadmapId);
  await acknowledgeOpening(recipient, newer);
  await acknowledgeOpening(recipient, older);
  expect(await notices()).toHaveLength(0);
  await ok(
    await author.patch(course.apiPath(`/nodes/${node.id}`), { data: { title: 'Nodo posterior' } }),
  );
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0].body).toBe(
    '«Nodo de la entrada nueva» pasó a llamarse «Nodo posterior».',
  );
});

test('a later empty entry recognizes restored content after an older entry acknowledgement', async ({
  course,
  teacherApi: author,
  studentApi: recipient,
}) => {
  const node = findNode(await (await author.get(course.apiPath())).json(), course.nodes.first);
  const notices = () => listNotices(recipient, { nodeId: node.id });
  const edit = async (title: string) =>
    ok(await author.patch(course.apiPath(`/nodes/${node.id}`), { data: { title } }));
  await edit('Título capturado por la entrada antigua');
  await expect.poll(notices).toHaveLength(1);
  const older = await prepareOpening(recipient, course.roadmapId);
  await edit(node.title);
  await expect.poll(notices).toHaveLength(0);
  const restored = await prepareOpening(recipient, course.roadmapId);
  await acknowledgeOpening(recipient, older);
  await expect.poll(notices).toHaveLength(1);
  await acknowledgeOpening(recipient, restored);
  expect(await notices()).toHaveLength(0);
  await edit('Título después de la restauración');
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0].body).toBe(
    `«${node.title}» pasó a llamarse «Título después de la restauración».`,
  );
});

test('a newer entry recognizes Node absence after an older entry recreates its deletion notice', async ({
  course,
  teacherApi: author,
  studentApi: recipient,
}) => {
  const nodeId = course.nodes.first;
  const notices = () => listNotices(recipient, { nodeId });
  // Establish lifecycle knowledge independently of later deletion delivery.
  await recognize(recipient, course.roadmapId);
  const older = await prepareOpening(recipient, course.roadmapId);
  await ok(await deleteNode(author, course.apiPath(`/nodes/${nodeId}`)), 204);
  await expect.poll(notices).toHaveLength(1);
  const newer = await prepareOpening(recipient, course.roadmapId);
  await acknowledgeOpening(recipient, older);
  await expect.poll(notices).toHaveLength(1);
  await acknowledgeOpening(recipient, newer);
  expect(await notices()).toHaveLength(0);
});

test('recognizing an ordinary entry does not notify an author about their own later edit', async ({
  course,
  teacherApi: author,
}) => {
  const opening = await prepareOpening(author, course.roadmapId);
  await ok(
    await author.patch(course.apiPath(`/nodes/${course.nodes.first}`), {
      data: { title: 'Cambio propio después de preparar la entrada' },
    }),
  );
  await acknowledgeOpening(author, opening);
  expect(await listNotices(author, { roadmapId: course.roadmapId })).toHaveLength(0);
});
