import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { test, type IntegrationCourse } from './fixtures';
import { addNode } from './roadmap';
import { prisma } from '@/shared/server/db';
import { listOwnNotices } from '@/features/notifications/server';

let clock = Date.now() - 60_000;

async function storeNotices(
  course: IntegrationCourse,
  targets: readonly Record<string, unknown>[],
) {
  const offering = await prisma.courseOffering.findFirstOrThrow({
    where: { roadmap: { id: course.roadmapId } },
    select: { id: true },
  });
  const notices = targets.map((target) => {
    const occurredAt = new Date((clock += 1000));
    return {
      id: randomUUID(),
      eventId: randomUUID(),
      recipientId: course.studentId,
      roadmapId: course.roadmapId,
      courseOfferingId: offering.id,
      targetKey: String(target.targetKey),
      subject: 'Aviso',
      body: 'Aviso',
      data: { ...course.identifier, roadmapId: course.roadmapId, context: {}, ...target },
      occurredAt,
      availableAt: occurredAt,
    };
  });
  await prisma.roadmapNotice.createMany({ data: notices });
  return notices.map(({ id }) => id);
}

const titleNotice = (nodeId: string) => ({
  noticeTarget: 'node-title',
  targetKey: `node:${nodeId}:title`,
  nodeId,
  knownValue: 'Antes',
  currentValue: 'Después',
});

async function inbox(course: IntegrationCourse) {
  return (
    await listOwnNotices(
      course.studentId,
      new URLSearchParams({ roadmapId: course.roadmapId, groupBy: 'roadmapId' }),
    )
  ).notifications;
}

test('three pending targets of a Roadmap become one Inbox row; availability never joins it', async ({
  course,
}) => {
  const nodes = await Promise.all(['Pilas', 'Colas'].map((title) => addNode(course, title)));
  const nodeIds = [course.change.nodeId, ...nodes.map(({ id }) => id)];
  const [availability] = await storeNotices(course, [
    {
      noticeTarget: 'roadmap-availability',
      targetKey: `roadmap:${course.roadmapId}:availability`,
      knownValue: 'absent',
      currentValue: 'present',
    },
  ]);
  const titles = await storeNotices(course, nodeIds.slice(0, 2).map(titleNotice));
  expect((await inbox(course)).map(({ id }) => id)).toEqual([titles[1], titles[0], availability]);

  const [newest] = await storeNotices(course, [titleNotice(nodeIds[2])]);
  expect(await inbox(course)).toMatchObject([
    {
      id: newest,
      body: 'El Roadmap ha recibido 3 cambios.',
      data: { roadmapId: course.roadmapId, targetCount: 3 },
    },
    { id: availability },
  ]);
});
