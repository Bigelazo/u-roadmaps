import 'dotenv/config';
import { expect } from 'vitest';
import {
  student,
  teacher,
  test,
  type IntegrationCourse,
} from '../../notifications-integration/fixtures';
import { prisma } from '@/shared/server/db';
import { readParticipantAccess } from '@/features/roadmap/access';
import { getRoadmapNodeResources } from '@/features/roadmap/server';

function addNode(
  course: IntegrationCourse,
  title: string,
  { isVisible = true, isTeacherBlocked = false } = {},
) {
  return prisma.roadmapNode.create({
    data: {
      roadmapId: course.roadmapId,
      nodeTypeId: course.nodeTypeId,
      title,
      positionX: 0,
      positionY: 0,
      isVisible,
      isTeacherBlocked,
    },
  });
}

test('reads one participant’s accessible Nodes in each Roadmap where their Participation is active', async ({
  course,
  otherCourse,
}) => {
  const first = course.change.nodeId;
  const dependent = await addNode(course, 'Pilas');
  await addNode(course, 'Colas', { isVisible: false });
  await addNode(course, 'Árboles', { isTeacherBlocked: true });
  await prisma.dependency.create({ data: { sourceNodeId: first, targetNodeId: dependent.id } });
  const roadmapIds = [course.roadmapId, otherCourse.roadmapId];
  const read = (userId: string) =>
    prisma.$transaction((tx) => readParticipantAccess(tx, { userId, roadmapIds }));

  expect(await read(course.studentId)).toEqual(new Map([[course.roadmapId, new Set([first])]]));
  expect(await read(course.teacherId)).toEqual(
    new Map([[course.roadmapId, new Set([first, dependent.id])]]),
  );

  await prisma.completion.create({ data: { userId: course.studentId, roadmapNodeId: first } });
  expect(await read(course.studentId)).toEqual(
    new Map([[course.roadmapId, new Set([first, dependent.id])]]),
  );

  await prisma.participation.updateMany({
    where: { userId: course.studentId },
    data: { isActive: false },
  });
  expect(await read(course.studentId)).toEqual(new Map());
});

test('each Roadmap’s access follows only its own Dependencies', async ({ course, otherCourse }) => {
  const offering = await prisma.courseOffering.findFirstOrThrow({
    where: { roadmap: { id: otherCourse.roadmapId } },
    select: { id: true },
  });
  await prisma.participation.create({
    data: { userId: course.studentId, courseOfferingId: offering.id, role: 'STUDENT' },
  });
  const first = course.change.nodeId;
  const dependent = await addNode(course, 'Pilas');
  const otherFirst = otherCourse.change.nodeId;
  const otherDependent = await addNode(otherCourse, 'Grafos');
  await prisma.dependency.createMany({
    data: [
      { sourceNodeId: first, targetNodeId: dependent.id },
      { sourceNodeId: otherFirst, targetNodeId: otherDependent.id },
    ],
  });
  const read = () =>
    prisma.$transaction((tx) =>
      readParticipantAccess(tx, {
        userId: course.studentId,
        roadmapIds: [course.roadmapId, otherCourse.roadmapId],
      }),
    );

  expect(await read()).toEqual(
    new Map([
      [course.roadmapId, new Set([first])],
      [otherCourse.roadmapId, new Set([otherFirst])],
    ]),
  );

  await prisma.completion.create({ data: { userId: course.studentId, roadmapNodeId: otherFirst } });
  expect(await read()).toEqual(
    new Map([
      [course.roadmapId, new Set([first])],
      [otherCourse.roadmapId, new Set([otherFirst, otherDependent.id])],
    ]),
  );
});

test('a student reaches a Node’s Resources only with the access Completion requires', async ({
  course,
}) => {
  const hidden = await addNode(course, 'Colas', { isVisible: false });
  const blocked = await addNode(course, 'Árboles', { isTeacherBlocked: true });
  const resources = (nodeId: string) => getRoadmapNodeResources({ ...student(course), nodeId });

  await expect(resources(course.change.nodeId)).resolves.toEqual([]);
  await expect(resources(hidden.id)).rejects.toMatchObject({ status: 404, code: 'NODE_NOT_FOUND' });
  await expect(resources(blocked.id)).rejects.toMatchObject({ status: 403, code: 'TEACHER_BLOCK' });
  await expect(getRoadmapNodeResources({ ...teacher(course), nodeId: hidden.id })).resolves.toEqual(
    [],
  );
});
