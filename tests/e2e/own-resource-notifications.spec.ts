import type { APIRequestContext } from '@playwright/test';
import { expect, test, type E2EPrimaryCourseOffering } from './fixtures';

async function pendingNotices(api: APIRequestContext, nodeId: string) {
  const response = await api.get(`/api/notifications?nodeId=${nodeId}&read=false`);
  expect(response.status()).toBe(200);
  return (await response.json()).notifications;
}

async function prepareOpening(api: APIRequestContext, roadmapId: string) {
  const opening = { roadmapId, operationId: crypto.randomUUID() };
  expect((await api.post('/api/notifications/openings', { data: opening })).status()).toBe(200);
  return opening;
}

async function acknowledgeOpening(
  api: APIRequestContext,
  opening: Awaited<ReturnType<typeof prepareOpening>>,
) {
  expect((await api.post('/api/notifications/acknowledge', { data: opening })).status()).toBe(200);
}

async function addResource(
  author: APIRequestContext,
  course: E2EPrimaryCourseOffering,
  nodeId = course.nodes.first,
) {
  const created = await author.post(course.apiPath(`/nodes/${nodeId}/resources`), {
    data: { title: 'Guía 3', url: 'https://example.test/guide', type: 'LINK' },
  });
  expect(created.status()).toBe(201);
  return (await created.json()).resource as { id: string };
}

async function editResourceTwice(
  author: APIRequestContext,
  path: string,
  notices: () => ReturnType<typeof pendingNotices>,
) {
  expect((await author.patch(path, { data: { title: 'Guía 3 resuelta' } })).status()).toBe(200);
  await expect
    .poll(async () => (await notices())[0]?.data.currentResource?.title)
    .toBe('Guía 3 resuelta');
  const pending = (await notices())[0];
  expect(
    (await author.patch(path, { data: { url: 'https://example.test/revised' } })).status(),
  ).toBe(200);
  await expect
    .poll(async () => (await notices())[0]?.data.currentResource?.revision)
    .not.toBe(pending.data.currentResource.revision);
  expect((await notices())[0].id).toBe(pending.id);
  return (await notices())[0];
}

test('added then edited then removed withdraws the Resource target', async ({ course, apiAs }) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const notices = () => pendingNotices(recipient, course.nodes.first);
  const resource = await addResource(author, course);
  await expect.poll(notices).toHaveLength(1);
  const path = course.apiPath(`/resources/${resource.id}`);
  const pending = await editResourceTwice(author, path, notices);
  expect(pending.data).toMatchObject({
    changeKind: 'resource-added',
    resourceTitle: 'Guía 3 resuelta',
  });
  expect((await author.delete(path)).status()).toBe(204);
  await expect.poll(notices).toHaveLength(0);
});

test('edited then removed retains the recipient-known Resource title', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const notices = () => pendingNotices(recipient, course.nodes.first);
  const resource = await addResource(author, course);
  await expect.poll(notices).toHaveLength(1);
  await acknowledgeOpening(recipient, await prepareOpening(recipient, course.roadmapId));
  expect(await notices()).toHaveLength(0);
  const path = course.apiPath(`/resources/${resource.id}`);
  const pending = await editResourceTwice(author, path, notices);
  expect(pending.data.changeKind).toBe('resource-updated');
  expect(pending.body).toContain('«Guía 3» ahora se llama «Guía 3 resuelta».');
  expect((await author.delete(path)).status()).toBe(204);
  await expect.poll(async () => (await notices())[0]?.data.changeKind).toBe('resource-removed');
  expect(await notices()).toHaveLength(1);
  expect((await notices())[0]).toMatchObject({ id: pending.id, data: { resourceTitle: 'Guía 3' } });
  expect((await notices())[0].body).toContain('Se eliminó el recurso «Guía 3»');
  await acknowledgeOpening(recipient, await prepareOpening(recipient, course.roadmapId));
  expect(await notices()).toHaveLength(0);
});

test('blocked students receive no Resource target', async ({ course, apiAs }) => {
  const author = await apiAs(course.users.teacher);
  const blocked = await apiAs(course.users.studentWithoutProgress);
  const accessible = await apiAs(course.users.studentWithProgress);
  const nodeId = course.nodes.second;
  await addResource(author, course, nodeId);
  await expect.poll(() => pendingNotices(accessible, nodeId)).toHaveLength(1);
  expect(await pendingNotices(blocked, nodeId)).toHaveLength(0);
});

test('Resource recognition rebases edits after opening and retries preserve later changes', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const notices = () => pendingNotices(recipient, course.nodes.first);
  const resource = await addResource(author, course);
  await expect.poll(notices).toHaveLength(1);
  const opening = await prepareOpening(recipient, course.roadmapId);
  expect(
    (
      await author.patch(course.apiPath(`/resources/${resource.id}`), {
        data: { title: 'Guía posterior' },
      })
    ).status(),
  ).toBe(200);
  await expect
    .poll(async () => (await notices())[0]?.data.currentResource?.title)
    .toBe('Guía posterior');
  for (let retry = 0; retry < 2; retry++) {
    await acknowledgeOpening(recipient, opening);
    expect(await notices()).toHaveLength(1);
    expect((await notices())[0].data).toMatchObject({
      changeKind: 'resource-updated',
      resourceTitle: 'Guía 3',
      currentResource: { title: 'Guía posterior' },
    });
  }
});

test('restoring Resource title URL and type withdraws the known-content notice', async ({
  course,
  apiAs,
}) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await apiAs(course.users.studentWithoutProgress);
  const notices = () => pendingNotices(recipient, course.nodes.first);
  const resource = await addResource(author, course);
  await expect.poll(notices).toHaveLength(1);
  await acknowledgeOpening(recipient, await prepareOpening(recipient, course.roadmapId));
  const path = course.apiPath(`/resources/${resource.id}`);
  expect(
    (
      await author.patch(path, {
        data: { title: 'Renamed', url: 'https://example.test/revised', type: 'VIDEO' },
      })
    ).status(),
  ).toBe(200);
  await expect.poll(notices).toHaveLength(1);
  expect(
    (
      await author.patch(path, {
        data: { title: 'Guía 3', url: 'https://example.test/guide', type: 'LINK' },
      })
    ).status(),
  ).toBe(200);
  await expect.poll(notices).toHaveLength(0);
});
