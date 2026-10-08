import { expect, test } from './fixtures';
import { createExistingNode } from './existing-node';
import { insert, sql } from './database';

for (const target of ['dependency', 'node-type-name'] as const)
  test(`hidden ${target} notices leave Inbox/counts, return when visible, and recognize without summary`, async ({
    course,
    apiAs,
  }) => {
    const author = await apiAs(course.users.teacher);
    const recipient = await apiAs(course.users.studentWithoutProgress);
    const createdType = await author.post(course.apiPath('/node-types'), {
      data: { name: 'Tipo conocido', icon: 'BookOpen', color: '#024AD8' },
    });
    expect(createdType.status()).toBe(201);
    const typeId = (await createdType.json()).nodeType.id;
    const sourceId = await createExistingNode({
      roadmapId: course.roadmapId,
      nodeTypeId: typeId,
      title: 'Origen conocido',
    });
    const recognize = async () => {
      const opening = { roadmapId: course.roadmapId, operationId: crypto.randomUUID() };
      expect(
        (await recipient.post('/api/notifications/openings', { data: opening })).status(),
      ).toBe(200);
      const response = await recipient.post('/api/notifications/acknowledge', { data: opening });
      expect(response.status()).toBe(200);
      return response.json();
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
      expect((await author.delete(course.apiPath(`/dependencies/${dependencyId}`))).status()).toBe(
        204,
      );
    } else {
      await recognize();
      expect(
        (
          await author.patch(course.apiPath(`/node-types/${typeId}`), {
            data: { name: 'Tipo renombrado' },
          })
        ).status(),
      ).toBe(200);
    }
    const allNotices = async () =>
      (await (await recipient.get(`/api/notifications?roadmapId=${course.roadmapId}`)).json())
        .notifications as { id: string; data: { noticeTarget: string } }[];
    const targetNotices = async () =>
      (await allNotices()).filter(({ data }) => data.noticeTarget === target);
    const count = async () =>
      (
        await (
          await recipient.get(`/api/notifications/counts?roadmapId=${course.roadmapId}`)
        ).json()
      ).count;
    const setVisible = async (isVisible: boolean) =>
      expect(
        (
          await author.patch(course.apiPath(`/nodes/${hiddenId}`), { data: { isVisible } })
        ).status(),
      ).toBe(200);
    await expect.poll(targetNotices).toHaveLength(1);
    const id = (await targetNotices())[0].id;
    expect(await count()).toBe(1);
    await setVisible(false);
    await expect.poll(targetNotices).toHaveLength(0);
    // Only the access withdrawal remains visible; the route target stays pending.
    await expect.poll(count).toBe(1);
    expect((await recipient.get(`/api/notifications/${id}`)).status()).toBe(404);
    await setVisible(true);
    await expect.poll(async () => (await targetNotices()).map((notice) => notice.id)).toEqual([id]);
    await expect.poll(count).toBe(1);
    await setVisible(false);
    await expect.poll(targetNotices).toHaveLength(0);
    const recognized = await recognize();
    expect(recognized.acknowledged).toBe(2);
    expect(
      recognized.summary.groups.some(
        (group: { title: string }) => group.title === 'Ruta y clasificación',
      ),
    ).toBe(false);
    expect(await allNotices()).toHaveLength(0);
    await setVisible(true);
    await expect.poll(allNotices).toHaveLength(1);
    expect(await targetNotices()).toHaveLength(0);
  });
