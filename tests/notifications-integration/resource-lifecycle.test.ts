import { expect } from 'vitest';
import { test, type IntegrationCourse } from './fixtures';
import {
  addNode,
  deferredNoticePort,
  enterRoadmap,
  pendingNotices,
  teacherEdits,
  announceRoadmap,
} from './roadmap';
import { prisma } from '@/shared/server/db';

type Notice = Awaited<ReturnType<typeof pendingNotices>>[number];

const resourceTargets = (notices: Notice[]) =>
  notices.filter(({ data }) => (data as { noticeTarget?: string }).noticeTarget === 'resource');

const pendingResources = async (userId: string, course: IntegrationCourse) =>
  resourceTargets(await pendingNotices(userId, course.roadmapId));

test('added then edited is a new Resource with its current title; added then removed is withdrawn', async ({
  course,
}) => {
  const edits = teacherEdits(course);
  const nodeId = course.change.nodeId;
  const resource = await edits.addResource(nodeId, 'Guía 3');
  const [added] = await pendingResources(course.studentId, course);
  await edits.editResource(resource.id, { title: 'Guía 3 resuelta' });
  await edits.editResource(resource.id, { url: 'https://example.test/revised' });
  const notices = await pendingResources(course.studentId, course);
  expect(notices).toHaveLength(1);
  expect(notices[0]).toMatchObject({
    id: added.id,
    subject: 'Guía 3 resuelta',
    body: 'Nuevo recurso «Guía 3 resuelta» en «Recursividad».',
    data: {
      noticeTarget: 'resource',
      noticeClass: 'roadmap-resource-changed',
      changeKind: 'resource-added',
      targetKind: 'node',
      nodeId,
      resourceId: resource.id,
      resourceTitle: 'Guía 3 resuelta',
      knownResource: null,
      currentResource: { title: 'Guía 3 resuelta' },
    },
  });
  expect(JSON.stringify(notices[0])).not.toMatch(/https?:/);
  expect(await pendingResources(course.teacherId, course)).toEqual([]);
  await edits.removeResource(resource.id);
  expect(await pendingResources(course.studentId, course)).toEqual([]);
});

test('an edit details only a title change, and edited then removed names the known title', async ({
  course,
}) => {
  const edits = teacherEdits(course);
  const resource = await edits.addResource(course.change.nodeId, 'Guía 3');
  await enterRoadmap(course.studentId, course.roadmapId);
  await edits.editResource(resource.id, { url: 'https://example.test/revised', type: 'VIDEO' });
  const [edited] = await pendingResources(course.studentId, course);
  expect(edited).toMatchObject({
    subject: 'Guía 3',
    body: 'Se actualizó el recurso «Guía 3» en «Recursividad».',
    data: { changeKind: 'resource-updated', resourceTitle: 'Guía 3' },
  });
  await edits.editResource(resource.id, { title: 'Guía 3 resuelta' });
  expect(await pendingResources(course.studentId, course)).toMatchObject([
    {
      id: edited.id,
      body: 'Se actualizó el recurso «Guía 3» en «Recursividad». «Guía 3» ahora se llama «Guía 3 resuelta».',
      data: { knownResource: { title: 'Guía 3' }, currentResource: { title: 'Guía 3 resuelta' } },
    },
  ]);
  await edits.removeResource(resource.id);
  expect(await pendingResources(course.studentId, course)).toMatchObject([
    {
      id: edited.id,
      subject: 'Guía 3',
      body: 'Se eliminó el recurso «Guía 3» de «Recursividad».',
      data: { changeKind: 'resource-removed', resourceTitle: 'Guía 3', currentResource: null },
    },
  ]);
});

test('restoring the known title, URL and type withdraws the Resource notice', async ({
  course,
}) => {
  const edits = teacherEdits(course);
  const resource = await edits.addResource(course.change.nodeId, 'Guía 3');
  await enterRoadmap(course.studentId, course.roadmapId);
  await edits.editResource(resource.id, {
    title: 'Otra',
    url: 'https://example.test/revised',
    type: 'VIDEO',
  });
  expect(await pendingResources(course.studentId, course)).toHaveLength(1);
  await edits.editResource(resource.id, {
    title: 'Guía 3',
    url: 'https://example.test/guide',
    type: 'LINK',
  });
  expect(await pendingResources(course.studentId, course)).toEqual([]);
});

test('recognition rebases a later edit on the captured Resource', async ({ course }) => {
  const edits = teacherEdits(course);
  const resource = await edits.addResource(course.change.nodeId, 'Guía 3');
  await enterRoadmap(course.studentId, course.roadmapId);
  await edits.editResource(resource.id, { title: 'Guía posterior' });
  await enterRoadmap(course.studentId, course.roadmapId);
  expect(await pendingResources(course.studentId, course)).toEqual([]);
  await edits.editResource(resource.id, { title: 'Guía 3' });
  expect(await pendingResources(course.studentId, course)).toMatchObject([
    {
      body: 'Se actualizó el recurso «Guía posterior» en «Recursividad». «Guía posterior» ahora se llama «Guía 3».',
    },
  ]);
});

test('Resource notices reach only recipients for whom the Node is accessible', async ({
  course,
}) => {
  const prerequisite = course.change.nodeId;
  const dependent = await addNode(course, 'Pilas');
  await prisma.dependency.create({
    data: { sourceNodeId: prerequisite, targetNodeId: dependent.id },
  });
  await prisma.completion.create({
    data: { userId: course.studentId, roadmapNodeId: prerequisite },
  });
  await teacherEdits(course).addResource(dependent.id, 'Guía de pilas');
  expect(await pendingResources(course.studentId, course)).toMatchObject([
    { data: { nodeId: dependent.id } },
  ]);
  expect(await pendingResources(course.classmateId, course)).toEqual([]);
  const hidden = await addNode(course, 'Colas', { isVisible: false });
  await teacherEdits(course).addResource(hidden.id, 'Guía oculta');
  expect(await pendingResources(course.studentId, course)).toHaveLength(1);
});

test('a pending Resource notice hides while its Node is blocked or hidden', async ({ course }) => {
  const nodeId = course.change.nodeId;
  await teacherEdits(course).addResource(nodeId, 'Guía 3');
  expect(await pendingResources(course.studentId, course)).toHaveLength(1);
  for (const state of [{ isTeacherBlocked: true }, { isVisible: false }]) {
    await prisma.roadmapNode.update({ where: { id: nodeId }, data: state });
    expect(await pendingResources(course.studentId, course)).toEqual([]);
    await prisma.roadmapNode.update({
      where: { id: nodeId },
      data: { isTeacherBlocked: false, isVisible: true },
    });
    expect(await pendingResources(course.studentId, course)).toHaveLength(1);
  }
});

test('creation, deletion and availability absorb Resource targets', async ({ course }) => {
  const edits = teacherEdits(course);
  const created = await edits.create('Árboles');
  await edits.addResource(created.id, 'Guía de árboles');
  expect(await pendingNotices(course.studentId, course.roadmapId)).toMatchObject([
    {
      data: {
        noticeTarget: 'node-creation',
        nodeId: created.id,
        resources: [{ title: 'Guía de árboles' }],
      },
    },
  ]);
  await enterRoadmap(course.studentId, course.roadmapId);
  await edits.addResource(created.id, 'Guía nueva');
  expect(await pendingResources(course.studentId, course)).toHaveLength(1);
  await edits.remove(created.id);
  expect(
    (await pendingNotices(course.studentId, course.roadmapId)).map(({ data }) => data),
  ).toMatchObject([{ changeKind: 'node-deleted', nodeId: created.id }]);

  await announceRoadmap(course);
  await edits.addResource(course.change.nodeId, 'Guía 3');
  expect(await pendingNotices(course.classmateId, course.roadmapId)).toMatchObject([
    { data: { changeKind: 'roadmap-available' } },
  ]);
});

test('concurrent and retried Resource deliveries leave one pending notice', async ({ course }) => {
  const deferred = deferredNoticePort();
  const edits = teacherEdits(course, deferred.port);
  const resource = await edits.addResource(course.change.nodeId, 'Guía 3');
  for (const title of ['Guía 4', 'Guía 5']) await edits.editResource(resource.id, { title });
  expect(deferred.deliveries).toHaveLength(3);
  await Promise.all([...deferred.deliveries, ...deferred.deliveries].map(deferred.deliver));
  await deferred.deliver(deferred.deliveries[0]);
  for (const recipient of [course.studentId, course.classmateId])
    expect(await pendingResources(recipient, course)).toMatchObject([
      { body: 'Nuevo recurso «Guía 5» en «Recursividad».' },
    ]);
});
