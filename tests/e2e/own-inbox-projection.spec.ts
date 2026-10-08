import { randomUUID } from 'node:crypto';
import { expect, test } from './fixtures';
import { insert, literal, sql } from './database';
import { studentNodeAccessById } from '../../src/features/roadmap/domain/access';
import { isNoticeVisible } from '../../src/features/notifications/application/notice-visibility';

// Compare the SQL projection with domain rules through HTTP on a real database.
// Fixture SQL sets up the graph; assertions concern only Inbox responses/counts.
test('database Inbox visibility agrees with domain rules across access and route targets', async ({
  course,
  apiAs,
}) => {
  const teacher = await apiAs(course.users.teacher);
  const student = await apiAs(course.users.studentWithoutProgress);
  const roadmap = await (await teacher.get(course.apiPath())).json();
  const specialTypeId = randomUUID();
  const nodes = Array.from({ length: 3 }, (_, index) => ({
    id: randomUUID(),
    roadmapId: course.roadmapId,
    nodeTypeId: index === 1 ? specialTypeId : roadmap.nodeTypes[0].id,
    title: `Projection ${index}`,
    isVisible: true,
    isTeacherBlocked: false,
    positionX: index * 100,
    positionY: 0,
  }));
  const edges = nodes.slice(1).map((node, index) => ({
    id: randomUUID(),
    sourceNodeId: nodes[index].id,
    targetNodeId: node.id,
  }));
  const completed = new Set([nodes[0].id]);
  await sql(
    insert('NodeType', [
      {
        id: specialTypeId,
        roadmapId: course.roadmapId,
        name: 'Projection',
        normalizedName: 'projection',
        icon: 'BookOpen',
        color: '#024AD8',
      },
    ]) +
      insert('RoadmapNode', nodes) +
      insert('Dependency', edges) +
      insert('Completion', [
        {
          id: randomUUID(),
          userId: course.users.studentWithoutProgress.id,
          roadmapNodeId: nodes[0].id,
        },
      ]),
  );
  const data = [
    ...nodes.flatMap((node) => [
      { noticeTarget: 'node-title', changeKind: 'node-updated', nodeId: node.id },
      { noticeTarget: 'node-description', changeKind: 'node-updated', nodeId: node.id },
      { noticeTarget: 'resource', changeKind: 'resource-updated', nodeId: node.id },
    ]),
    ...edges.map((edge) => ({
      noticeTarget: 'dependency',
      changeKind: 'dependency-added',
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
    })),
    {
      noticeTarget: 'node-type-name',
      changeKind: 'classification-updated',
      nodeTypeId: specialTypeId,
    },
  ];
  const subjects = data.map((_, index) => `Target ${index}`);
  const at = new Date();
  await sql(
    insert(
      'RoadmapNotice',
      [course.users.teacher, course.users.studentWithoutProgress].flatMap((user) =>
        data.map((target, index) => ({
          id: randomUUID(),
          eventId: randomUUID(),
          recipientId: user.id,
          roadmapId: course.roadmapId,
          courseOfferingId: course.id,
          subject: subjects[index],
          body: subjects[index],
          data: JSON.stringify({
            ...target,
            courseCode: course.courseCode,
            roadmapId: course.roadmapId,
          }),
          occurredAt: at,
          availableAt: at,
        })),
      ),
    ),
  );
  for (const state of [
    'pending prerequisite',
    'teacher blocked prerequisite',
    'hidden intermediary',
    'completed chain',
  ]) {
    nodes[0].isTeacherBlocked = state === 'teacher blocked prerequisite';
    nodes[1].isVisible = state !== 'hidden intermediary';
    // This branch configures the final access scenario; assertions are shared.
    // eslint-disable-next-line playwright/no-conditional-in-test
    if (state === 'completed chain') {
      completed.add(nodes[1].id);
      await sql(
        insert('Completion', [
          {
            id: randomUUID(),
            userId: course.users.studentWithoutProgress.id,
            roadmapNodeId: nodes[1].id,
          },
        ]),
      );
    }
    await sql(`UPDATE "RoadmapNode" SET "isTeacherBlocked" = ${literal(nodes[0].isTeacherBlocked)} WHERE id = ${literal(nodes[0].id)};
      UPDATE "RoadmapNode" SET "isVisible" = ${literal(nodes[1].isVisible)} WHERE id = ${literal(nodes[1].id)};`);
    // Hiding removes Dependencies through the application; this fixture projects
    // visible endpoints explicitly, as the existing access domain does.
    const visibleNodes = nodes.filter((node) => node.isVisible);
    const visibleEdges = edges.filter(
      (edge) =>
        visibleNodes.some((node) => node.id === edge.sourceNodeId) &&
        visibleNodes.some((node) => node.id === edge.targetNodeId),
    );
    const studentAccess = studentNodeAccessById({
      nodes: visibleNodes,
      dependencies: visibleEdges,
      completedNodeIds: completed,
    });
    const accessibleStudent = new Set(
      [...studentAccess].filter(([, access]) => access.status === 'ACCESSIBLE').map(([id]) => id),
    );
    const accessibleTeacher = new Set(
      visibleNodes.filter((node) => !node.isTeacherBlocked).map((node) => node.id),
    );
    for (const [recipient, accessible] of [
      [student, accessibleStudent],
      [teacher, accessibleTeacher],
    ] as const) {
      const expected = data
        .flatMap((target, index) =>
          isNoticeVisible(target, nodes, accessible) ? [subjects[index]] : [],
        )
        .sort();
      const query = `/api/notifications?roadmapId=${course.roadmapId}`;
      const response = await recipient.get(`${query}&limit=100`);
      expect(response.status()).toBe(200);
      const all = await response.json();
      expect(
        all.notifications.map((notice: { subject: string }) => notice.subject).sort(),
        state,
      ).toEqual(expected);
      expect(
        (
          await (
            await recipient.get(`/api/notifications/counts?roadmapId=${course.roadmapId}`)
          ).json()
        ).count,
        state,
      ).toBe(expected.length);
      const paged: string[] = [];
      let cursor = '';
      let hasMore = true;
      while (hasMore) {
        const page = await (
          await recipient.get(`${query}&limit=2${cursor ? `&after=${cursor}` : ''}`)
        ).json();
        expect(page.notifications.length).toBeLessThanOrEqual(2);
        paged.push(...page.notifications.map((notice: { subject: string }) => notice.subject));
        cursor = page.notifications.at(-1)?.id ?? '';
        hasMore = page.hasMore;
      }
      expect(paged.sort()).toEqual(expected);
    }
  }
});
