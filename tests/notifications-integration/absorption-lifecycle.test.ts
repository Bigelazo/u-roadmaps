import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { test, type IntegrationCourse } from './fixtures';
import { prisma } from '@/shared/server/db';
import { scheduledRoadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { createRoadmap } from '@/features/roadmap/application/roadmap';
import { acknowledgeOwnNotices, prepareOwnRoadmapOpening } from '@/features/notifications/server';
import {
  confirmed,
  deferredNoticePort,
  enterRoadmap,
  pendingNotices,
  teacherEdits,
} from './roadmap';

type Notice = Awaited<ReturnType<typeof pendingNotices>>[number];
const data = (notice: Notice) => notice.data as Record<string, unknown>;
const forNode = (notices: Notice[], nodeId: string) =>
  notices.filter((notice) => data(notice).nodeId === nodeId);

test('a pending Node creation absorbs title, description and Resources with the current state', async ({
  course,
}) => {
  const edits = teacherEdits(course);
  const node = await edits.create('Colas');
  const [first] = await pendingNotices(course.studentId, course.roadmapId);
  await edits.rename(node.id, 'Pilas');
  await edits.update(node.id, { description: 'Último en entrar' });
  await edits.addResource(node.id, 'Guía');
  const notices = await pendingNotices(course.studentId, course.roadmapId);
  expect(notices).toHaveLength(1);
  expect(notices[0]).toMatchObject({
    id: first.id,
    subject: 'Nuevo Nodo «Pilas»',
    body: 'Nuevo Nodo «Pilas».',
    data: {
      noticeTarget: 'node-creation',
      changeKind: 'node-available',
      nodeId: node.id,
      nodeTitle: 'Pilas',
      nodeDescription: 'Último en entrar',
      nodeAccess: 'Disponible',
      resources: [expect.objectContaining({ title: 'Guía' })],
    },
  });
  expect(await pendingNotices(course.teacherId, course.roadmapId)).toEqual([]);
});

test('a pending Node creation then blocked is a blocked new Node', async ({ course }) => {
  const edits = teacherEdits(course);
  const node = await edits.create('Pilas');
  await edits.update(node.id, { description: 'Privada' });
  await edits.block(node.id);
  const notices = await pendingNotices(course.studentId, course.roadmapId);
  expect(notices).toHaveLength(1);
  expect(notices[0]).toMatchObject({
    subject: 'Nuevo Nodo «Pilas»',
    body: 'Nuevo Nodo «Pilas» (Bloqueado).',
    data: { noticeTarget: 'node-creation', nodeAccess: 'Bloqueado', nodeDescription: null },
  });
});

test('creating then deleting or hiding leaves no notice; showing again is a new Node', async ({
  course,
}) => {
  const edits = teacherEdits(course);
  const deleted = await edits.create('Efímero');
  await edits.remove(deleted.id);
  expect(await pendingNotices(course.studentId, course.roadmapId)).toEqual([]);
  const hidden = await edits.create('Oculto');
  await edits.update(hidden.id, { isVisible: false });
  expect(await pendingNotices(course.studentId, course.roadmapId)).toEqual([]);
  await edits.update(hidden.id, { isVisible: true });
  expect(await pendingNotices(course.studentId, course.roadmapId)).toMatchObject([
    { subject: 'Nuevo Nodo «Oculto»', data: { noticeTarget: 'node-creation', nodeId: hidden.id } },
  ]);
});

test('deleting a Node absorbs its pending title, access and Resource notices and forgets its Known values', async ({
  course,
}) => {
  const edits = teacherEdits(course);
  const nodeId = course.change.nodeId;
  await edits.rename(nodeId, 'Recursión');
  await edits.addResource(nodeId, 'Guía');
  await edits.block(nodeId);
  expect(
    forNode(await pendingNotices(course.studentId, course.roadmapId), nodeId)
      .map((notice) => data(notice).noticeTarget)
      .sort(),
  ).toEqual(['node-access', 'node-title']);
  await edits.remove(nodeId);
  expect(await pendingNotices(course.studentId, course.roadmapId)).toMatchObject([
    {
      subject: 'Recursión',
      data: { changeKind: 'node-deleted', targetKind: 'roadmap', nodeId, nodeTitle: 'Recursión' },
    },
  ]);
  expect(await prisma.noticeKnownValue.count({ where: { nodeId } })).toBe(0);
});

test('deleting a Node nobody is told about forgets every Known value of it, unknown creations included', async ({
  course,
}) => {
  const edits = teacherEdits(course);
  const hidden = await edits.create('Borrador');
  await edits.update(hidden.id, { isVisible: false });
  expect(await prisma.noticeKnownValue.count({ where: { nodeId: hidden.id } })).toBeGreaterThan(0);
  await edits.remove(hidden.id);
  expect(await prisma.noticeKnownValue.findMany({ where: { nodeId: hidden.id } })).toEqual([]);
  expect(await pendingNotices(course.studentId, course.roadmapId)).toEqual([]);
});

test('deleting a new Node leaves no Known value once its deletion is delivered', async ({
  course,
}) => {
  const edits = teacherEdits(course);
  const node = await edits.create('Colas');
  await edits.remove(node.id);
  expect(await prisma.noticeKnownValue.findMany({ where: { nodeId: node.id } })).toEqual([]);
  expect(await pendingNotices(course.studentId, course.roadmapId)).toEqual([]);
});

test('a Node deleted after entry captured its creation is a pending deletion once recognized', async ({
  course,
}) => {
  const edits = teacherEdits(course);
  const node = await edits.create('Pilas');
  const opening = await prepareOwnRoadmapOpening(course.studentId, {
    roadmapId: course.roadmapId,
    operationId: randomUUID(),
  });
  await edits.remove(node.id);
  expect(await pendingNotices(course.studentId, course.roadmapId)).toEqual([]);
  await acknowledgeOwnNotices(course.studentId, opening);
  expect(await pendingNotices(course.studentId, course.roadmapId)).toMatchObject([
    { subject: 'Pilas', data: { changeKind: 'node-deleted', nodeId: node.id } },
  ]);
});

test('entry knows a new Node whose creation notice was never delivered', async ({ course }) => {
  const deferred = deferredNoticePort();
  const node = await teacherEdits(course, deferred.port).create('Pilas');
  await enterRoadmap(course.studentId, course.roadmapId);
  await teacherEdits(course).addResource(node.id, 'Guía');
  for (const delivery of deferred.deliveries) await deferred.deliver(delivery);
  expect(await pendingNotices(course.studentId, course.roadmapId)).toMatchObject([
    { data: { noticeTarget: 'resource', changeKind: 'resource-added' } },
  ]);
});

/** A new Course offering of the same Course with this course's people, and its Roadmap. */
async function newRoadmap(course: IntegrationCourse, copy: boolean) {
  await prisma.roadmap.update({ where: { id: course.roadmapId }, data: { closedAt: new Date() } });
  const identifier = { ...course.identifier, year: 2027, semester: 1 };
  await prisma.courseOffering.create({
    data: {
      courseCode: course.identifier.courseCode,
      year: 2027,
      semester: 1,
      participants: {
        create: [
          { userId: course.teacherId, role: 'TEACHER' },
          { userId: course.studentId, role: 'STUDENT' },
        ],
      },
    },
  });
  const { roadmap } = await confirmed(
    createRoadmap(
      identifier,
      copy ? { source: course.identifier } : {},
      { id: course.teacherId, name: 'Docente' },
      scheduledRoadmapChangePort,
    ),
  );
  const nodeTypeId = (
    (await prisma.nodeType.findFirst({ where: { roadmapId: roadmap.id } })) ??
    (await prisma.nodeType.create({
      data: {
        name: 'Tema',
        normalizedName: 'tema',
        icon: 'BookOpen',
        color: '#024AD8',
        roadmapId: roadmap.id,
      },
    }))
  ).id;
  return { ...course, roadmapId: roadmap.id, identifier, nodeTypeId };
}

test.for([false, true])(
  'an unrecognized Roadmap availability is the only notice for that Roadmap (copy: %s)',
  async (copy, { course }) => {
    const next = await newRoadmap(course, copy);
    const edits = teacherEdits(next);
    const node = await edits.create('Colas');
    await edits.rename(node.id, 'Pilas');
    await edits.addResource(node.id, 'Guía');
    const removed = await edits.create('Eliminado');
    await edits.remove(removed.id);
    expect(await pendingNotices(next.studentId, next.roadmapId)).toMatchObject([
      {
        subject: `Roadmap disponible: ${next.identifier.courseCode}`,
        data: { changeKind: 'roadmap-available', noticeClass: 'roadmap-available' },
      },
    ]);
    expect(await pendingNotices(next.teacherId, next.roadmapId)).toEqual([]);
    await enterRoadmap(next.studentId, next.roadmapId);
    expect(await pendingNotices(next.studentId, next.roadmapId)).toEqual([]);
    await edits.rename(node.id, 'Pilas avanzadas');
    expect(await pendingNotices(next.studentId, next.roadmapId)).toMatchObject([
      {
        data: { noticeTarget: 'node-title', knownTitle: 'Pilas', currentTitle: 'Pilas avanzadas' },
      },
    ]);
  },
);
