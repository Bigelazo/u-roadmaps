import { expect } from 'vitest';
import { test } from './fixtures';
import { addNode, enterRoadmap, teacherEdits } from './roadmap';
import { countOwnCourseOfferingNotices, countOwnNotices } from '@/features/notifications/server';
import { prisma } from '@/shared/server/db';

function courseBellCount(userId: string, identifier: Record<string, string | number>) {
  return countOwnNotices(
    userId,
    new URLSearchParams(Object.entries(identifier).map(([key, value]) => [key, String(value)])),
  );
}

test('a Course offering count matches the unread count of its Roadmap bell', async ({
  course,
  otherCourse,
}) => {
  const otherOffering = await prisma.courseOffering.findFirstOrThrow({
    where: { roadmap: { id: otherCourse.roadmapId } },
    select: { id: true },
  });
  await prisma.participation.create({
    data: { userId: course.studentId, courseOfferingId: otherOffering.id, role: 'STUDENT' },
  });
  const nodeB = (await addNode(course, 'Pilas')).id;
  const edits = teacherEdits(course);
  await edits.rename(course.change.nodeId, 'Recursión');
  await edits.rename(nodeB, 'Pilas dobles');
  await teacherEdits(otherCourse).rename(otherCourse.change.nodeId, 'Colas');

  const roadmapBell = await countOwnNotices(
    course.studentId,
    new URLSearchParams({ roadmapId: course.roadmapId }),
  );
  expect(roadmapBell.count).toBe(2);
  expect(await courseBellCount(course.studentId, course.identifier)).toEqual(roadmapBell);
  expect(await countOwnCourseOfferingNotices(course.studentId, course.identifier)).toEqual({
    unread: 2,
  });
  expect(await countOwnCourseOfferingNotices(course.studentId, otherCourse.identifier)).toEqual({
    unread: 1,
  });

  await enterRoadmap(course.studentId, course.roadmapId);
  expect(await countOwnCourseOfferingNotices(course.studentId, course.identifier)).toEqual({
    unread: 0,
  });
  expect(await countOwnCourseOfferingNotices(course.classmateId, course.identifier)).toEqual({
    unread: 2,
  });
});

test('a user without an active Participation counts nothing for another Course offering', async ({
  course,
  otherCourse,
}) => {
  await teacherEdits(course).rename(course.change.nodeId, 'Recursión');
  expect(await countOwnCourseOfferingNotices(otherCourse.studentId, course.identifier)).toEqual({
    unread: 0,
  });
  await prisma.participation.update({
    where: { id: course.participationId },
    data: { isActive: false },
  });
  expect(await countOwnCourseOfferingNotices(course.studentId, course.identifier)).toEqual({
    unread: 0,
  });
});

test('an offering without a Roadmap and an unknown offering both count nothing', async ({
  course,
}) => {
  const withoutRoadmap = { ...course.identifier, year: 2027 };
  await prisma.courseOffering.create({
    data: {
      ...withoutRoadmap,
      participants: { create: { userId: course.studentId, role: 'STUDENT' } },
    },
  });
  expect(await countOwnCourseOfferingNotices(course.studentId, withoutRoadmap)).toEqual({
    unread: 0,
  });
  expect(
    await countOwnCourseOfferingNotices(course.studentId, { ...course.identifier, year: 1999 }),
  ).toEqual({ unread: 0 });
});
