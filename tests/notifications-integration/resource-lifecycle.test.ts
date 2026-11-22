import { expect } from 'vitest';
import { test, type IntegrationCourse } from './fixtures';
import { deferredNoticePort, enterRoadmap, pendingTargets, teacherEdits } from './roadmap';

const pendingResources = (userId: string, course: IntegrationCourse) =>
  pendingTargets(userId, course.roadmapId, 'resource');

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
  await edits.editResource(resource.id, { url: 'https://example.test/revised', type: 'LINK' });
  const [edited] = await pendingResources(course.studentId, course);
  expect(edited).toMatchObject({
    subject: 'Guía 3',
    body: 'Se actualizó el recurso «Guía 3» en «Recursividad».',
    data: { noticeTarget: 'resource', resourceTitle: 'Guía 3' },
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
      data: { resourceTitle: 'Guía 3', currentResource: null },
    },
  ]);
});

test('concurrent and retried deliveries of an added Resource leave one pending notice', async ({
  course,
}) => {
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
