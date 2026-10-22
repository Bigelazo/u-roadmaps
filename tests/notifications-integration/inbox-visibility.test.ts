import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { test } from './fixtures';
import { prisma } from '@/shared/server/db';
import {
  countOwnNodeChangeTargets,
  countOwnNotices,
  listOwnNotices,
} from '@/features/notifications/server';
import { isNoticeVisible } from '@/features/notifications/application/notice-visibility';
import { participantNodeAccess } from '@/features/roadmap/domain/participant-view';

const STATES = [
  'pending prerequisite',
  'teacher-blocked prerequisite',
  'hidden intermediary',
  'completed chain',
] as const;

async function listedIds(userId: string, roadmapId: string) {
  const ids: string[] = [];
  let after: string | undefined;
  for (let hasMore = true; hasMore;) {
    const page = await listOwnNotices(
      userId,
      new URLSearchParams({ roadmapId, limit: '2', ...(after ? { after } : {}) }),
    );
    expect(page.notifications.length).toBeLessThanOrEqual(2);
    ids.push(...page.notifications.map(({ id }) => id));
    after = page.notifications.at(-1)?.id;
    hasMore = page.hasMore;
  }
  return ids.sort();
}

test('the Inbox, its counts and Node change marks agree with the participant view', async ({
  course,
}) => {
  const { roadmapId, studentId, teacherId } = course;
  const offering = await prisma.courseOffering.findFirstOrThrow({
    where: { roadmap: { id: roadmapId } },
    select: { id: true },
  });
  const specialType = await prisma.nodeType.create({
    data: {
      roadmapId,
      name: 'Proyección',
      normalizedName: 'proyeccion',
      icon: 'BookOpen',
      color: '#024AD8',
    },
  });
  const chain = await Promise.all(
    [0, 1, 2].map((index) =>
      prisma.roadmapNode.create({
        data: {
          roadmapId,
          title: `Proyección ${index}`,
          nodeTypeId: index === 1 ? specialType.id : course.nodeTypeId,
          positionX: index * 100,
          positionY: 0,
        },
      }),
    ),
  );
  const edges = await Promise.all(
    chain.slice(1).map((node, index) =>
      prisma.dependency.create({
        data: { sourceNodeId: chain[index].id, targetNodeId: node.id },
      }),
    ),
  );
  await prisma.completion.create({ data: { userId: studentId, roadmapNodeId: chain[0].id } });

  const targets: { nodeId?: string; [key: string]: unknown }[] = [
    ...chain.flatMap((node) => [
      { noticeTarget: 'node-title', nodeId: node.id },
      { noticeTarget: 'node-description', nodeId: node.id },
      { noticeTarget: 'resource', nodeId: node.id },
    ]),
    ...edges.map(({ sourceNodeId, targetNodeId }) => ({
      noticeTarget: 'dependency',
      sourceNodeId,
      targetNodeId,
    })),
    {
      noticeTarget: 'node-type-name',
      nodeTypeId: specialType.id,
    },
    { noticeTarget: 'node-access', nodeId: chain[1].id },
    { noticeTarget: 'node-title', nodeId: randomUUID() },
    { noticeTarget: 'node-description', nodeId: randomUUID() },
    { nodeId: chain[0].id },
    {},
  ];
  const occurredAt = new Date();
  const notices = [studentId, teacherId].flatMap((recipientId) =>
    targets.map((data, index) => ({
      id: randomUUID(),
      eventId: randomUUID(),
      recipientId,
      roadmapId,
      courseOfferingId: offering.id,
      subject: `Target ${index}`,
      body: `Target ${index}`,
      data: { ...data, ...course.identifier, roadmapId },
      occurredAt,
      availableAt: occurredAt,
      acknowledgedAt: data.noticeTarget === 'resource' ? occurredAt : null,
    })),
  );
  await prisma.roadmapNotice.createMany({ data: notices });

  for (const state of STATES) {
    await prisma.roadmapNode.update({
      where: { id: chain[0].id },
      data: { isTeacherBlocked: state === 'teacher-blocked prerequisite' },
    });
    await prisma.roadmapNode.update({
      where: { id: chain[1].id },
      data: { isVisible: state !== 'hidden intermediary' },
    });
    if (state === 'completed chain')
      await prisma.completion.create({ data: { userId: studentId, roadmapNodeId: chain[1].id } });

    const [nodes, dependencies, completions] = await Promise.all([
      prisma.roadmapNode.findMany({ where: { roadmapId } }),
      prisma.dependency.findMany({ where: { sourceNode: { roadmapId } } }),
      prisma.completion.findMany({ where: { userId: studentId } }),
    ]);
    const completedNodeIds = new Set(completions.map(({ roadmapNodeId }) => roadmapNodeId));
    for (const [recipientId, participant] of [
      [studentId, { role: 'STUDENT', completedNodeIds }],
      [teacherId, { role: 'TEACHER' }],
    ] as const) {
      const { accessibleNodeIds } = participantNodeAccess({ participant, nodes, dependencies });
      const visible = notices.filter(
        (notice) =>
          notice.recipientId === recipientId &&
          isNoticeVisible(notice.data, nodes, accessibleNodeIds, participant.role),
      );
      const pending = visible.filter(({ acknowledgedAt }) => acknowledgedAt === null);
      const marks: Record<string, number> = {};
      for (const { data } of visible)
        if (data.nodeId) marks[data.nodeId] = (marks[data.nodeId] ?? 0) + 1;
      const params = new URLSearchParams({ roadmapId });
      expect({
        state,
        role: participant.role,
        listed: await listedIds(recipientId, roadmapId),
        counts: await countOwnNotices(recipientId, params),
        marks: await countOwnNodeChangeTargets(recipientId, params),
      }).toEqual({
        state,
        role: participant.role,
        listed: pending.map(({ id }) => id).sort(),
        counts: { count: pending.length },
        marks: { byNode: marks },
      });
    }
  }
});
