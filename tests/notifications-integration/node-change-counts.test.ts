import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { test, type IntegrationCourse } from './fixtures';
import { addNode, enterRoadmap, teacherEdits } from './roadmap';
import {
  countOwnNodeChangeTargets,
  countOwnNotices,
  listOwnNotices,
  reviewOwnNode,
} from '@/features/notifications/server';
import { prisma } from '@/shared/server/db';

const t = new Date('2026-11-05T12:00:00.000Z');
const before = new Date('2026-11-05T11:59:59.999Z');
const after = new Date('2026-11-05T12:00:00.001Z');
const params = (course: IntegrationCourse) => new URLSearchParams({ roadmapId: course.roadmapId });

async function seedTargets(
  course: IntegrationCourse,
  recipientId: string,
  targets: Array<{ aspect: 'title' | 'description' | 'type'; at?: Date; nullKey?: boolean }>,
) {
  const { courseOfferingId } = await prisma.roadmap.findUniqueOrThrow({
    where: { id: course.roadmapId },
    select: { courseOfferingId: true },
  });
  const nodeId = course.change.nodeId;
  await prisma.roadmapNotice.createMany({
    data: targets.map(({ aspect, at = after, nullKey = false }) => ({
      eventId: randomUUID(),
      recipientId,
      roadmapId: course.roadmapId,
      courseOfferingId,
      targetKey: nullKey ? null : `node:${nodeId}:${aspect}`,
      subject: 'Cambio de prueba',
      body: 'Cambio de prueba',
      data: { ...course.identifier, nodeId, noticeTarget: `node-${aspect}` },
      occurredAt: at,
      availableAt: at,
    })),
  });
}

test('empty public Inbox counts and Node marks retain their complete result shapes', async ({
  course,
}) => {
  expect(await countOwnNotices(course.studentId, params(course))).toEqual({ count: 0 });
  expect(await countOwnNodeChangeTargets(course.studentId, params(course))).toEqual({ byNode: {} });
  expect(await listOwnNotices(course.studentId, params(course))).toEqual({
    notifications: [],
    hasMore: false,
  });
});

test('two null target keys on one visible Node fall back to distinct notice identities', async ({
  course,
}) => {
  await seedTargets(course, course.studentId, [
    { aspect: 'title', nullKey: true },
    { aspect: 'title', nullKey: true },
  ]);
  expect(await countOwnNotices(course.studentId, params(course))).toEqual({ count: 2 });
  expect(await countOwnNodeChangeTargets(course.studentId, params(course))).toEqual({
    byNode: { [course.change.nodeId]: 2 },
  });
});

test('Roadmap recognition retains both Node marks and reviewing A clears only this recipient’s A', async ({
  course,
}) => {
  const nodeA = course.change.nodeId;
  const nodeB = (await addNode(course, 'Pilas')).id;
  const edits = teacherEdits(course);
  await edits.rename(nodeA, 'Recursión');
  await edits.rename(nodeB, 'Pilas dobles');
  const both = { byNode: { [nodeA]: 1, [nodeB]: 1 } };
  expect(await countOwnNotices(course.studentId, params(course))).toEqual({ count: 2 });
  expect(await countOwnNodeChangeTargets(course.studentId, params(course))).toEqual(both);
  expect(await countOwnNodeChangeTargets(course.classmateId, params(course))).toEqual(both);
  await enterRoadmap(course.studentId, course.roadmapId);
  expect(await countOwnNotices(course.studentId, params(course))).toEqual({ count: 0 });
  expect(await countOwnNodeChangeTargets(course.studentId, params(course))).toEqual(both);
  expect(
    await reviewOwnNode(course.studentId, { roadmapId: course.roadmapId, nodeId: nodeA }),
  ).toEqual({ reviewed: true });
  expect(await countOwnNodeChangeTargets(course.studentId, params(course))).toEqual({
    byNode: { [nodeB]: 1 },
  });
  expect(await countOwnNodeChangeTargets(course.classmateId, params(course))).toEqual(both);
});

test('Node review excludes changes at and before its millisecond and retains only later targets', async ({
  course,
}) => {
  await seedTargets(course, course.studentId, [
    { aspect: 'title', at: before },
    { aspect: 'description', at: t },
    { aspect: 'type', at: after },
  ]);
  await prisma.nodeChangeReview.create({
    data: { recipientId: course.studentId, nodeId: course.change.nodeId, reviewedAt: t },
  });
  expect(await countOwnNodeChangeTargets(course.studentId, params(course))).toEqual({
    byNode: { [course.change.nodeId]: 1 },
  });
  expect(await countOwnNotices(course.studentId, params(course))).toEqual({ count: 3 });
});

test('Participation reset admits only targets strictly after its millisecond without a Node review', async ({
  course,
}) => {
  await prisma.participation.update({
    where: { id: course.participationId },
    data: { noticeResetAt: t },
  });
  await seedTargets(course, course.studentId, [
    { aspect: 'title', at: before },
    { aspect: 'description', at: t },
    { aspect: 'type', at: after },
  ]);
  expect(await countOwnNodeChangeTargets(course.studentId, params(course))).toEqual({
    byNode: { [course.change.nodeId]: 1 },
  });
  expect(await countOwnNotices(course.studentId, params(course))).toEqual({ count: 3 });
});

test('eligible recipients and two active Roadmaps retain asymmetric independent counts and marks', async ({
  course,
  otherCourse,
}) => {
  const { courseOfferingId } = await prisma.roadmap.findUniqueOrThrow({
    where: { id: otherCourse.roadmapId },
    select: { courseOfferingId: true },
  });
  await prisma.participation.create({
    data: { userId: course.studentId, courseOfferingId, role: 'STUDENT' },
  });
  await seedTargets(course, course.studentId, [{ aspect: 'title' }, { aspect: 'description' }]);
  await seedTargets(course, course.classmateId, [
    { aspect: 'title' },
    { aspect: 'description' },
    { aspect: 'type' },
  ]);
  await seedTargets(otherCourse, course.studentId, [{ aspect: 'title' }]);
  expect(await countOwnNotices(course.studentId, params(course))).toEqual({ count: 2 });
  expect(await countOwnNodeChangeTargets(course.studentId, params(course))).toEqual({
    byNode: { [course.change.nodeId]: 2 },
  });
  expect(await countOwnNotices(course.classmateId, params(course))).toEqual({ count: 3 });
  expect(await countOwnNodeChangeTargets(course.classmateId, params(course))).toEqual({
    byNode: { [course.change.nodeId]: 3 },
  });
  expect(await countOwnNotices(course.studentId, params(otherCourse))).toEqual({ count: 1 });
  expect(await countOwnNodeChangeTargets(course.studentId, params(otherCourse))).toEqual({
    byNode: { [otherCourse.change.nodeId]: 1 },
  });
});

test('defensive inactive snapshot rejects post-reset notices independently of trigger deletion', async ({
  course,
}) => {
  await prisma.participation.update({
    where: { id: course.participationId },
    data: { isActive: false },
  });
  await prisma.participation.update({
    where: { id: course.participationId },
    data: { noticeResetAt: t },
  });
  await seedTargets(course, course.studentId, [{ aspect: 'title', at: after }]);
  expect(await countOwnNotices(course.studentId, params(course))).toEqual({ count: 0 });
  expect(await countOwnNodeChangeTargets(course.studentId, params(course))).toEqual({ byNode: {} });
  await prisma.participation.update({
    where: { id: course.participationId },
    data: { isActive: true },
  });
  expect(await countOwnNotices(course.studentId, params(course))).toEqual({ count: 1 });
  expect(await countOwnNodeChangeTargets(course.studentId, params(course))).toEqual({
    byNode: { [course.change.nodeId]: 1 },
  });
});

test('public count and Node review operations reject missing and invalid identities', async ({
  course,
}) => {
  for (const roadmapId of ['', 'invalid']) {
    await expect(
      countOwnNodeChangeTargets(course.studentId, new URLSearchParams({ roadmapId })),
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
  }
  await expect(
    countOwnNodeChangeTargets(course.studentId, new URLSearchParams()),
  ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
  await expect(
    countOwnNotices(course.studentId, new URLSearchParams({ roadmapId: 'invalid' })),
  ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
  for (const input of [
    { nodeId: course.change.nodeId },
    { roadmapId: 'invalid', nodeId: course.change.nodeId },
    { roadmapId: course.roadmapId },
    { roadmapId: course.roadmapId, nodeId: 'invalid' },
  ]) {
    await expect(reviewOwnNode(course.studentId, input)).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST',
    });
  }
});

test('Node review refuses absent or inactive Participation and Nodes outside its Roadmap', async ({
  course,
  otherCourse,
}) => {
  const input = { roadmapId: course.roadmapId, nodeId: course.change.nodeId };
  await expect(reviewOwnNode(otherCourse.studentId, input)).rejects.toMatchObject({
    status: 403,
    code: 'FORBIDDEN',
  });
  await prisma.participation.update({
    where: { id: course.participationId },
    data: { isActive: false },
  });
  await expect(reviewOwnNode(course.studentId, input)).rejects.toMatchObject({
    status: 403,
    code: 'FORBIDDEN',
  });
  await prisma.participation.update({
    where: { id: course.participationId },
    data: { isActive: true },
  });
  for (const nodeId of [otherCourse.change.nodeId, randomUUID()]) {
    await expect(reviewOwnNode(course.studentId, { ...input, nodeId })).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  }
});
