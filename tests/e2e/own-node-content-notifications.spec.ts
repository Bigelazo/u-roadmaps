import type { APIRequestContext } from '@playwright/test';
import { expect, test } from './fixtures';
import { ok } from './helpers';
import {
  acknowledgeOpening,
  findNode,
  listNotices,
  pendingNotices,
  prepareOpening,
  type StoredNotice,
} from './notices';

const byTarget = (notices: StoredNotice[], target: string) =>
  notices.find((notice) => notice.data.noticeTarget === target);

test('blocked students receive title and type targets; accessible students also receive description', async ({
  course,
  apiAs,
  teacherApi: author,
  studentApi: blocked,
}) => {
  const accessible = await apiAs(course.users.studentWithProgress);
  const roadmap = await (await author.get(course.apiPath())).json();
  const node = findNode(roadmap, course.nodes.second);
  const nextType = roadmap.nodeTypes.find((value: { id: string }) => value.id !== node.nodeTypeId);
  await ok(
    await author.patch(course.apiPath(`/nodes/${node.id}`), {
      data: { title: 'Pilas', description: 'Descripción nueva', nodeTypeId: nextType.id },
    }),
  );
  const targets = async (api: APIRequestContext) =>
    (await pendingNotices(api, node.id)).map((notice) => notice.data.noticeTarget).sort();
  await expect.poll(() => targets(blocked)).toEqual(['node-title', 'node-type']);
  await expect
    .poll(() => targets(accessible))
    .toEqual(['node-description', 'node-title', 'node-type']);
});

test('description and type targets absorb edits independently, withdraw exact returns, and retain assignment names', async ({
  course,
  teacherApi: author,
  studentApi: recipient,
}) => {
  const roadmap = await (await author.get(course.apiPath())).json();
  const node = findNode(roadmap, course.nodes.first);
  const path = course.apiPath(`/nodes/${node.id}`);
  const notices = () => pendingNotices(recipient, node.id);
  const edit = async (data: Record<string, unknown>) => ok(await author.patch(path, { data }));
  const createType = async (name: string) => {
    const response = await ok(
      await author.post(course.apiPath('/node-types'), {
        data: { name, icon: 'BookOpen', color: '#024AD8' },
      }),
      201,
    );
    return (await response.json()).nodeType;
  };
  const typeB = await createType('Lectura');
  const typeC = await createType('Taller');
  await edit({ description: 'Primera descripción' });
  await expect.poll(notices).toHaveLength(1);
  const descriptionId = (await notices())[0].id;
  await edit({ description: 'Segunda descripción' });
  await expect
    .poll(async () => (await notices())[0]?.data.currentValue)
    .toBe('"Segunda descripción"');
  expect((await notices())[0]).toMatchObject({
    id: descriptionId,
    body: `Se actualizó la descripción de «${node.title}».`,
  });
  await edit({ title: 'Pilas', nodeTypeId: typeB.id });
  await expect.poll(notices).toHaveLength(3);
  const typeNotice = byTarget(await notices(), 'node-type')!;
  const currentTypeNotice = async () =>
    (await notices()).find((notice) => notice.id === typeNotice.id)!;
  await edit({ nodeTypeId: typeC.id });
  await expect
    .poll(
      async () =>
        (await notices()).find((notice) => notice.id === typeNotice.id)?.data.currentTypeName,
    )
    .toBe('Taller');
  expect((await currentTypeNotice()).body).toBe(
    `«Pilas» pasó de tipo «${roadmap.nodeTypes.find((type: { id: string }) => type.id === node.nodeTypeId).name}» a tipo «Taller».`,
  );
  await ok(
    await author.patch(course.apiPath(`/node-types/${typeC.id}`), {
      data: { name: 'Taller renombrado' },
    }),
  );
  await expect
    .poll(async () =>
      (await listNotices(recipient, { roadmapId: course.roadmapId })).some(
        (notice) => notice.data.noticeTarget === 'node-type-name',
      ),
    )
    .toBe(true);
  expect((await currentTypeNotice()).data).toMatchObject({ currentTypeName: 'Taller' });
  await edit({ description: `${node.description ?? ''} ` });
  await expect.poll(notices).toHaveLength(3);
  await edit({ description: node.description });
  await expect.poll(notices).toHaveLength(2);
  await edit({ nodeTypeId: node.nodeTypeId });
  await expect.poll(notices).toHaveLength(1);
  expect((await notices())[0].data.noticeTarget).toBe('node-title');
});

test('recognition rebases later description and type edits and retries do not recognize them', async ({
  course,
  teacherApi: author,
  studentApi: recipient,
}) => {
  const roadmap = await (await author.get(course.apiPath())).json();
  const node = findNode(roadmap, course.nodes.first);
  const types = roadmap.nodeTypes.filter((value: { id: string }) => value.id !== node.nodeTypeId);
  const path = course.apiPath(`/nodes/${node.id}`);
  const notices = () => pendingNotices(recipient, node.id);
  await ok(
    await author.patch(path, {
      data: { description: 'Descripción reconocida', nodeTypeId: types[0].id },
    }),
  );
  await expect.poll(notices).toHaveLength(2);
  const opening = await prepareOpening(recipient, course.roadmapId);
  await ok(
    await author.patch(path, {
      data: { description: 'Descripción posterior', nodeTypeId: types[1].id },
    }),
  );
  await expect
    .poll(async () => byTarget(await notices(), 'node-type')?.data.currentValue)
    .toBe(types[1].id);
  for (let retry = 0; retry < 2; retry++) {
    await acknowledgeOpening(recipient, opening);
    const pending = await notices();
    expect(pending).toHaveLength(2);
    expect(byTarget(pending, 'node-description')!.data).toMatchObject({
      knownValue: '"Descripción reconocida"',
      currentValue: '"Descripción posterior"',
    });
    expect(byTarget(pending, 'node-type')!.data).toMatchObject({
      knownValue: types[0].id,
      knownTypeName: types[0].name,
      currentValue: types[1].id,
      currentTypeName: types[1].name,
    });
  }
  await ok(
    await author.patch(path, {
      data: { description: 'Descripción reconocida', nodeTypeId: types[0].id },
    }),
  );
  await expect.poll(notices).toHaveLength(0);
});

test('description changes while blocked do not seed knowledge the recipient never saw', async ({
  course,
  teacherApi: author,
  studentApi: recipient,
}) => {
  const roadmap = await (await author.get(course.apiPath())).json();
  const node = findNode(roadmap, course.nodes.second);
  const path = course.apiPath(`/nodes/${node.id}`);
  const descriptions = async () =>
    (await listNotices(recipient, { nodeId: node.id })).filter(
      (notice) => notice.data.noticeTarget === 'node-description',
    );
  await ok(
    await author.patch(path, {
      data: { description: 'Descripción publicada durante el bloqueo' },
    }),
  );
  expect(await descriptions()).toHaveLength(0);
  await ok(await recipient.post(course.apiPath(`/nodes/${course.nodes.first}/completion`)));
  const accessible = await (await recipient.get(course.apiPath())).json();
  expect(findNode(accessible, node.id).description).toBe(
    'Descripción publicada durante el bloqueo',
  );
  await ok(await author.patch(path, { data: { description: node.description } }));
  await expect.poll(descriptions).toHaveLength(1);
  expect((await descriptions())[0].data.knownValue).toBe(
    '"Descripción publicada durante el bloqueo"',
  );
});
