import { expect, test } from './fixtures';
import { createExistingNode } from './existing-node';
import { insert, sql } from './database';
import { ok } from './helpers';
import { listNotices, prepareOpening } from './notices';
import { hideNode } from './previewed-writes';

for (const target of ['dependency', 'node-type-name'] as const)
  test(`hidden ${target} notices leave Inbox/counts, return when visible, and recognize without summary`, async ({
    course,
    teacherApi: author,
    studentApi: recipient,
  }) => {
    const createdType = await author.post(course.apiPath('/node-types'), {
      data: { name: 'Tipo conocido', icon: 'BookOpen', color: '#024AD8' },
    });
    const typeId = (await (await ok(createdType, 201)).json()).nodeType.id;
    const sourceId = await createExistingNode({
      roadmapId: course.roadmapId,
      nodeTypeId: typeId,
      title: 'Origen conocido',
    });
    const recognize = async () => {
      const opening = await prepareOpening(recipient, course.roadmapId);
      return (
        await ok(await recipient.post('/api/notifications/acknowledge', { data: opening }))
      ).json();
    };
    let hiddenId = sourceId;
    if (target === 'dependency') {
      hiddenId = await createExistingNode({
        roadmapId: course.roadmapId,
        nodeTypeId: typeId,
        title: 'Destino conocido',
      });
      const dependencyId = crypto.randomUUID();
      await sql(
        insert('Completion', [
          {
            id: crypto.randomUUID(),
            userId: course.users.studentWithoutProgress.id,
            roadmapNodeId: sourceId,
          },
        ]),
      );
      await sql(
        insert('Dependency', [
          { id: dependencyId, sourceNodeId: sourceId, targetNodeId: hiddenId },
        ]),
      );
      await recognize();
      await ok(await author.delete(course.apiPath(`/dependencies/${dependencyId}`)), 204);
    } else {
      await recognize();
      await ok(
        await author.patch(course.apiPath(`/node-types/${typeId}`), {
          data: { name: 'Tipo renombrado' },
        }),
      );
    }
    const allNotices = () => listNotices(recipient, { roadmapId: course.roadmapId });
    const targetNotices = async () =>
      (await allNotices()).filter(({ data }) => data.noticeTarget === target);
    const count = async () =>
      (
        await (
          await recipient.get(`/api/notifications/counts?roadmapId=${course.roadmapId}`)
        ).json()
      ).count;
    const nodePath = course.apiPath(`/nodes/${hiddenId}`);
    const hide = async () => ok(await hideNode(author, nodePath));
    const show = async () => ok(await author.patch(nodePath, { data: { isVisible: true } }));
    await expect.poll(targetNotices).toHaveLength(1);
    const id = (await targetNotices())[0].id;
    expect(await count()).toBe(1);
    await hide();
    await expect.poll(targetNotices).toHaveLength(0);
    await expect.poll(count).toBe(1);
    await ok(await recipient.get(`/api/notifications/${id}`), 404);
    await show();
    await expect.poll(async () => (await targetNotices()).map((notice) => notice.id)).toEqual([id]);
    await expect.poll(count).toBe(1);
    await hide();
    await expect.poll(targetNotices).toHaveLength(0);
    const recognized = await recognize();
    expect(recognized.acknowledged).toBe(2);
    expect(
      recognized.summary.groups.some(
        (group: { title: string }) => group.title === 'Ruta y clasificación',
      ),
    ).toBe(false);
    expect(await allNotices()).toHaveLength(0);
    await show();
    await expect.poll(allNotices).toHaveLength(1);
    expect(await targetNotices()).toHaveLength(0);
  });
