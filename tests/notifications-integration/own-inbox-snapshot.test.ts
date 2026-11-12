import { expect } from 'vitest';
import { test, type IntegrationCourse } from './fixtures';
import { addNode, enterRoadmap, teacherEdits } from './roadmap';
import { prisma } from '@/shared/server/db';
import {
  countOwnCourseOfferingNotices,
  listOwnNotices,
  readOwnInbox,
} from '@/features/notifications/server';

async function enrollInOtherCourse(userId: string, otherCourse: IntegrationCourse) {
  const offering = await prisma.courseOffering.findFirstOrThrow({
    where: { roadmap: { id: otherCourse.roadmapId } },
    select: { id: true },
  });
  await prisma.participation.create({
    data: { userId, courseOfferingId: offering.id, role: 'STUDENT' },
  });
}

async function groupedInboxIds(userId: string) {
  const { notifications } = await listOwnNotices(
    userId,
    new URLSearchParams({ groupBy: 'roadmapId', limit: '100' }),
  );
  return notifications.map(({ id }) => id);
}

async function expectMatchesCourseCounts(userId: string, courses: readonly IntegrationCourse[]) {
  const snapshot = await readOwnInbox(userId);
  for (const course of courses) {
    const { unread } = await countOwnCourseOfferingNotices(userId, course.identifier);
    const offering = snapshot.offerings.find(({ roadmapId }) => roadmapId === course.roadmapId);
    expect(offering?.unread ?? 0).toBe(unread);
  }
  expect(snapshot.notices.map(({ id }) => id)).toEqual(await groupedInboxIds(userId));
  return snapshot;
}

test('one snapshot counts every Course offering and lists its grouped notices newest first', async ({
  course,
  otherCourse,
}) => {
  await enrollInOtherCourse(course.studentId, otherCourse);
  const nodes = await Promise.all(['Pilas', 'Colas'].map((title) => addNode(course, title)));
  const edits = teacherEdits(course);
  await edits.rename(course.change.nodeId, 'Recursión');
  await edits.rename(nodes[0].id, 'Pilas dobles');
  await edits.rename(nodes[1].id, 'Colas dobles');
  await teacherEdits(otherCourse).rename(otherCourse.change.nodeId, 'Árboles');

  const snapshot = await expectMatchesCourseCounts(course.studentId, [course, otherCourse]);
  expect(snapshot.total).toBe(4);
  expect(snapshot.offerings).toEqual(
    expect.arrayContaining([
      { roadmapId: course.roadmapId, ...course.identifier, unread: 3 },
      { roadmapId: otherCourse.roadmapId, ...otherCourse.identifier, unread: 1 },
    ]),
  );
  expect(snapshot.offerings).toHaveLength(2);
  expect(snapshot.notices).toMatchObject([
    { roadmapId: otherCourse.roadmapId, courseName: 'Curso de prueba' },
    {
      roadmapId: course.roadmapId,
      body: 'El Roadmap ha recibido 3 cambios.',
      data: { roadmapId: course.roadmapId, targetCount: 3 },
    },
  ]);
  for (const notice of snapshot.notices)
    expect(new Date(notice.createdAt).toISOString()).toBe(notice.createdAt);
  expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
});

test('a snapshot keeps hidden and blocked Node notices from students only', async ({ course }) => {
  const hidden = await addNode(course, 'Pilas');
  const blocked = await addNode(course, 'Colas');
  const edits = teacherEdits(course);
  await edits.rename(course.change.nodeId, 'Recursión');
  await edits.rename(hidden.id, 'Pilas dobles');
  await edits.rename(blocked.id, 'Colas dobles');
  await edits.update(hidden.id, { isVisible: false });
  await edits.block(blocked.id);

  const student = await expectMatchesCourseCounts(course.studentId, [course]);
  const colleague = await expectMatchesCourseCounts(course.colleagueId, [course]);
  expect(student.total).toBeLessThan(colleague.total);
  expect(student.notices.map(({ data }) => data?.nodeId)).not.toContain(hidden.id);
  expect(student.notices.map(({ data }) => data?.nodeId)).not.toContain(blocked.id);
});

test('acknowledged notices leave the snapshot of their recipient only', async ({ course }) => {
  await teacherEdits(course).rename(course.change.nodeId, 'Recursión');
  await enterRoadmap(course.studentId, course.roadmapId);

  expect(await readOwnInbox(course.studentId)).toEqual({ total: 0, offerings: [], notices: [] });
  expect((await readOwnInbox(course.classmateId)).total).toBe(1);
});
