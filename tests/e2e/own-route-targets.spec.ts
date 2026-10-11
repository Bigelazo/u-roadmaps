import { expect, test } from './fixtures';
import { createDependency } from './create-node';
import { ok } from './helpers';
import { listNotices, recognize } from './notices';

test('removing and re-adding a Dependency with a new id withdraws the same pair target', async ({
  course,
  teacherApi: author,
  apiAs,
}) => {
  const recipient = await apiAs(course.users.studentWithProgress);
  const roadmap = await (await author.get(course.apiPath())).json();
  const dependency = roadmap.dependencies[0];
  const pair = { sourceNodeId: dependency.sourceNodeId, targetNodeId: dependency.targetNodeId };
  const notices = async () =>
    (await listNotices(recipient, { roadmapId: course.roadmapId, limit: 100 })).filter(
      ({ data }) =>
        data.sourceNodeId === pair.sourceNodeId && data.targetNodeId === pair.targetNodeId,
    );
  await ok(await author.delete(course.apiPath(`/dependencies/${dependency.id}`)), 204);
  await expect
    .poll(notices)
    .toMatchObject([
      { data: { changeKind: 'dependency-removed', knownValue: 'present', currentValue: 'absent' } },
    ]);
  const readdedId = await createDependency(author, course, pair.sourceNodeId, pair.targetNodeId);
  expect(readdedId).not.toBe(dependency.id);
  await expect.poll(notices).toHaveLength(0);
  const current = await (await author.get(course.apiPath())).json();
  const replacement = current.dependencies.find(
    (edge: typeof pair) =>
      edge.sourceNodeId === pair.sourceNodeId && edge.targetNodeId === pair.targetNodeId,
  );
  await ok(await author.delete(course.apiPath(`/dependencies/${replacement.id}`)), 204);
  await expect.poll(notices).toMatchObject([{ data: { changeKind: 'dependency-removed' } }]);
  await recognize(recipient, course.roadmapId);
  await createDependency(author, course, pair.sourceNodeId, pair.targetNodeId);
  await expect
    .poll(notices)
    .toMatchObject([
      { data: { changeKind: 'dependency-added', knownValue: 'absent', currentValue: 'present' } },
    ]);
});

test('Node type renames retain the known name and withdraw a return; appearance changes stay silent', async ({
  course,
  teacherApi: author,
  studentApi: recipient,
}) => {
  const created = await author.post(course.apiPath('/node-types'), {
    data: { name: 'Lectura', icon: 'BookOpen', color: '#024AD8' },
  });
  const typeId = (await (await ok(created, 201)).json()).nodeType.id;
  await ok(
    await author.patch(course.apiPath(`/nodes/${course.nodes.first}`), {
      data: { nodeTypeId: typeId },
    }),
  );
  const notices = async () =>
    (await listNotices(recipient, { roadmapId: course.roadmapId, limit: 100 })).filter(
      ({ data }) => data.noticeTarget === 'node-type-name' && data.nodeTypeId === typeId,
    );
  const rename = async (name: string) =>
    ok(await author.patch(course.apiPath(`/node-types/${typeId}`), { data: { name } }));
  await rename('Lectura guiada');
  await expect.poll(notices).toHaveLength(1);
  const firstId = (await notices())[0].id;
  await rename('Lectura obligatoria');
  await expect
    .poll(notices)
    .toMatchObject([
      { id: firstId, body: 'El tipo «Lectura» ahora se llama «Lectura obligatoria».' },
    ]);
  await rename('Lectura');
  await expect.poll(notices).toHaveLength(0);
  await ok(
    await author.patch(course.apiPath(`/node-types/${typeId}`), {
      data: { icon: 'BookText', color: '#1467A8' },
    }),
  );
  expect(await notices()).toHaveLength(0);
  await rename('Taller');
  await expect.poll(notices).toHaveLength(1);
  await recognize(recipient, course.roadmapId);
  await rename('Seminario');
  await expect
    .poll(notices)
    .toMatchObject([{ body: 'El tipo «Taller» ahora se llama «Seminario».' }]);
});
