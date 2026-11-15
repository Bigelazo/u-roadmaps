import { expect } from 'vitest';
import { prisma } from '@/shared/server/db';
import { test, type IntegrationCourse } from './fixtures';
import { addNode, enterRoadmap, pendingNotices, teacherEdits } from './roadmap';

async function accessKnownValues(course: IntegrationCourse) {
  const rows = await prisma.noticeKnownValue.findMany({
    where: { roadmapId: course.roadmapId, noticeTarget: 'node-access' },
    select: {
      recipientId: true,
      nodeId: true,
      targetKey: true,
      knownValue: true,
      currentValue: true,
    },
  });
  const names = new Map([
    [course.studentId, 'student'],
    [course.classmateId, 'classmate'],
  ]);
  return rows
    .map(({ recipientId, ...row }) => ({
      recipient: names.get(recipientId) ?? recipientId,
      ...row,
    }))
    .sort((a, b) => `${a.recipient}${a.targetKey}`.localeCompare(`${b.recipient}${b.targetKey}`));
}

async function accessBodies(userId: string, roadmapId: string) {
  return (await pendingNotices(userId, roadmapId))
    .filter(({ data }) => (data as { noticeTarget?: string }).noticeTarget === 'node-access')
    .map(({ body }) => body)
    .sort();
}

test('a blocking Dependency records each changed Node access and delivers its notices', async ({
  course,
}) => {
  const prerequisite = await addNode(course, 'Diagnóstico');
  const target = await addNode(course, 'Listas');
  const dependent = await addNode(course, 'Árboles');
  const edits = teacherEdits(course);
  await edits.connect(target.id, dependent.id);
  await prisma.completion.create({ data: { userId: course.studentId, roadmapNodeId: target.id } });
  await enterRoadmap(course.classmateId, course.roadmapId);
  const classmateEntry = (await accessKnownValues(course)).filter(
    ({ recipient }) => recipient === 'classmate',
  );

  await edits.connect(prerequisite.id, target.id);

  const key = (nodeId: string) => `node:${nodeId}:access`;
  expect(await accessKnownValues(course)).toEqual(
    [
      ...classmateEntry.map((row) =>
        row.nodeId === target.id ? { ...row, currentValue: 'Bloqueado' } : row,
      ),
      {
        recipient: 'student',
        nodeId: dependent.id,
        targetKey: key(dependent.id),
        knownValue: 'Disponible',
        currentValue: 'Bloqueado',
      },
      {
        recipient: 'student',
        nodeId: target.id,
        targetKey: key(target.id),
        knownValue: 'Disponible',
        currentValue: 'Bloqueado',
      },
    ].sort((a, b) => `${a.recipient}${a.targetKey}`.localeCompare(`${b.recipient}${b.targetKey}`)),
  );
  expect(classmateEntry.find(({ nodeId }) => nodeId === target.id)).toMatchObject({
    knownValue: 'Disponible',
    currentValue: null,
  });
  expect(await accessBodies(course.studentId, course.roadmapId)).toEqual([
    '«Listas» fue bloqueado.',
    '«Árboles» fue bloqueado.',
  ]);
  expect(await accessBodies(course.classmateId, course.roadmapId)).toEqual([
    '«Listas» fue bloqueado.',
  ]);
  expect(await accessBodies(course.teacherId, course.roadmapId)).toEqual([]);
});
