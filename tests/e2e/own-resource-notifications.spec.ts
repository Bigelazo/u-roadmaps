import type { APIRequestContext } from '@playwright/test';
import { expect, test, type E2EPrimaryCourseOffering } from './fixtures';
import { ok } from './helpers';
import { pendingNotices, prepareOpening, acknowledgeOpening, recognize } from './notices';

async function addResource(
  author: APIRequestContext,
  course: E2EPrimaryCourseOffering,
  nodeId = course.nodes.first,
) {
  const created = await author.post(course.apiPath(`/nodes/${nodeId}/resources`), {
    data: { title: 'Guía 3', url: 'https://example.test/guide', type: 'LINK' },
  });
  return (await (await ok(created, 201)).json()).resource as { id: string };
}

async function editResourceTwice(
  author: APIRequestContext,
  path: string,
  notices: () => ReturnType<typeof pendingNotices>,
) {
  await ok(await author.patch(path, { data: { title: 'Guía 3 resuelta' } }));
  await expect
    .poll(async () => (await notices())[0]?.data.currentResource?.title)
    .toBe('Guía 3 resuelta');
  const pending = (await notices())[0];
  await ok(await author.patch(path, { data: { url: 'https://example.test/revised' } }));
  await expect
    .poll(async () => (await notices())[0]?.data.currentResource?.revision)
    .not.toBe(pending.data.currentResource.revision);
  expect((await notices())[0].id).toBe(pending.id);
  return (await notices())[0];
}

test('added then edited then removed withdraws the Resource target', async ({
  course,
  teacherApi: author,
  studentApi: recipient,
}) => {
  const notices = () => pendingNotices(recipient, course.nodes.first);
  const resource = await addResource(author, course);
  await expect.poll(notices).toHaveLength(1);
  const path = course.apiPath(`/resources/${resource.id}`);
  const pending = await editResourceTwice(author, path, notices);
  expect(pending.data).toMatchObject({
    knownResource: null,
    resourceTitle: 'Guía 3 resuelta',
  });
  await ok(await author.delete(path), 204);
  await expect.poll(notices).toHaveLength(0);
});

test('edited then removed retains the recipient-known Resource title', async ({
  course,
  teacherApi: author,
  studentApi: recipient,
}) => {
  const notices = () => pendingNotices(recipient, course.nodes.first);
  const resource = await addResource(author, course);
  await expect.poll(notices).toHaveLength(1);
  await recognize(recipient, course.roadmapId);
  expect(await notices()).toHaveLength(0);
  const path = course.apiPath(`/resources/${resource.id}`);
  const pending = await editResourceTwice(author, path, notices);
  expect(pending.body).toContain('Se actualizó el recurso «Guía 3»');
  expect(pending.body).toContain('«Guía 3» ahora se llama «Guía 3 resuelta».');
  await ok(await author.delete(path), 204);
  await expect.poll(async () => (await notices())[0]?.data.currentResource).toBeNull();
  expect(await notices()).toHaveLength(1);
  expect((await notices())[0]).toMatchObject({ id: pending.id, data: { resourceTitle: 'Guía 3' } });
  expect((await notices())[0].body).toContain('Se eliminó el recurso «Guía 3»');
  await recognize(recipient, course.roadmapId);
  expect(await notices()).toHaveLength(0);
});

test('blocked students receive no Resource target', async ({
  course,
  apiAs,
  teacherApi: author,
  studentApi: blocked,
}) => {
  const accessible = await apiAs(course.users.studentWithProgress);
  const nodeId = course.nodes.second;
  await addResource(author, course, nodeId);
  await expect.poll(() => pendingNotices(accessible, nodeId)).toHaveLength(1);
  expect(await pendingNotices(blocked, nodeId)).toHaveLength(0);
});

test('Resource recognition rebases edits after opening and retries preserve later changes', async ({
  course,
  teacherApi: author,
  studentApi: recipient,
}) => {
  const notices = () => pendingNotices(recipient, course.nodes.first);
  const resource = await addResource(author, course);
  await expect.poll(notices).toHaveLength(1);
  const opening = await prepareOpening(recipient, course.roadmapId);
  await ok(
    await author.patch(course.apiPath(`/resources/${resource.id}`), {
      data: { title: 'Guía posterior' },
    }),
  );
  await expect
    .poll(async () => (await notices())[0]?.data.currentResource?.title)
    .toBe('Guía posterior');
  for (let retry = 0; retry < 2; retry++) {
    await acknowledgeOpening(recipient, opening);
    expect(await notices()).toHaveLength(1);
    expect((await notices())[0].data).toMatchObject({
      resourceTitle: 'Guía 3',
      currentResource: { title: 'Guía posterior' },
    });
  }
});

test('restoring Resource title URL and type withdraws the known-content notice', async ({
  course,
  teacherApi: author,
  studentApi: recipient,
}) => {
  const notices = () => pendingNotices(recipient, course.nodes.first);
  const resource = await addResource(author, course);
  await expect.poll(notices).toHaveLength(1);
  await recognize(recipient, course.roadmapId);
  const path = course.apiPath(`/resources/${resource.id}`);
  await ok(
    await author.patch(path, {
      data: { title: 'Renamed', url: 'https://example.test/revised', type: 'LINK' },
    }),
  );
  await expect.poll(notices).toHaveLength(1);
  await ok(
    await author.patch(path, {
      data: { title: 'Guía 3', url: 'https://example.test/guide', type: 'LINK' },
    }),
  );
  await expect.poll(notices).toHaveLength(0);
});
