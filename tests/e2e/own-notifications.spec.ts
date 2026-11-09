import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { insert, literal, queryJson, sql } from './database';
import { expect, test } from './fixtures';
import { authenticateAs, ok } from './helpers';
import { listNotices, storeTitleNotices } from './notices';

test('own Inbox requires authentication and isolates notice identities', async ({
  request,
  page,
  course,
  studentApi,
}) => {
  await ok(await request.get('/api/notifications'), 401);
  const response = await ok(await studentApi.get('/api/notifications'));
  expect(await response.json()).toMatchObject({ notifications: [], hasMore: false });
  await authenticateAs(page.context(), course.users.studentWithoutProgress.id);
  await page.goto('/academic-overview');
  await page.getByRole('button', { name: 'Avisos', exact: true }).click();
  await expect(page.getByText('No tienes avisos todavía.')).toBeVisible();
});

test('Roadmap creation persists one own notice for each eligible Participation and browser opening recognizes it', async ({
  page,
  course,
  apiAs,
  teacherApi: author,
  createCourse,
}) => {
  const { teacher, teachingAssistant, multiCourseStudent, studentWithoutProgress } = course.users;
  const { withdrawnStudent, studentComplete: outsider } = course.users;
  const offering = await createCourse({
    roadmap: false,
    participants: [
      { user: teacher, role: 'TEACHER' },
      { user: teachingAssistant, role: 'TEACHER' },
      { user: multiCourseStudent, role: 'STUDENT' },
      { user: studentWithoutProgress, role: 'STUDENT' },
      { user: withdrawnStudent, role: 'STUDENT', isActive: false },
    ],
  });
  const path = offering.apiPath();
  const created = await ok(await author.post(path, { data: {} }), 201);
  const roadmapId = (await created.json()).roadmap.id;
  await ok(await author.post(path, { data: {} }), 409);
  for (const user of Object.values(course.users)) {
    const { id } = user;
    const eligible = [teachingAssistant.id, multiCourseStudent.id, studentWithoutProgress.id];
    const api = await apiAs(user);
    await expect
      .poll(async () => (await listNotices(api, { roadmapId })).length, {
        message: `audience for ${id}`,
      })
      .toBe(eligible.includes(id) ? 1 : 0);
    const notices = await listNotices(api, { roadmapId });
    expect(notices, `audience for ${id}`).toHaveLength(eligible.includes(id) ? 1 : 0);
  }
  await sql(
    insert('Participation', [
      {
        id: randomUUID(),
        userId: outsider.id,
        courseOfferingId: offering.id,
        role: 'STUDENT',
        isActive: true,
      },
    ]),
  );
  expect(await listNotices(await apiAs(outsider), {})).toHaveLength(0);
  const recipient = await apiAs(multiCourseStudent);
  const first = (await getJson(recipient, `/api/notifications?roadmapId=${roadmapId}`))
    .notifications[0];
  const subject = `Roadmap disponible: ${offering.courseCode}`;
  expect(first).toMatchObject({ subject, read: false });
  expect((await listNotices(author, { roadmapId })).map(({ id }) => id)).not.toContain(first.id);
  const listed = async () =>
    (await listNotices(recipient, { roadmapId })).find(({ id }) => id === first.id);
  const acknowledged = () =>
    queryJson<boolean>(
      `SELECT to_jsonb("acknowledgedAt" IS NOT NULL) FROM "RoadmapNotice" WHERE id = ${literal(first.id)};`,
    );
  await authenticateAs(page.context(), multiCourseStudent.id);
  await page.goto(course.pagePath());
  await page.getByRole('button', { name: 'Avisos, 1 sin leer', exact: true }).click();
  const row = page
    .getByRole('list', { name: 'Lista de avisos' })
    .getByRole('button', { name: first.courseName });
  await expect(row).toBeVisible();
  expect(await listed()).not.toHaveProperty('seen');
  expect(await listed()).toMatchObject({ id: first.id, read: false });
  await row.click();
  await expect(page).toHaveURL(offering.pagePath());
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(acknowledged).toBe(true);
  expect(await listed()).toBeUndefined();
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await acknowledged()).toBe(true);
  expect(await listed()).toBeUndefined();
});

test('pagination and visible rows preserve notices when entry recognition fails', async ({
  page,
  course,
  apiAs,
  createCourse,
}) => {
  const { roadmapId } = course;
  const recipient = course.users.multiCourseStudent;
  const otherCourse = await createCourse({
    participants: [{ user: recipient, role: 'STUDENT' }],
  });
  const api = await apiAs(recipient);
  const ids = (await storeTitleNotices(course, recipient.id, 12, new Date('2026-01-01T00:00:00Z')))
    .sort()
    .reverse();
  const first = await getJson(api, `/api/notifications?roadmapId=${roadmapId}&limit=10`);
  expect(first.notifications.map((notice: { id: string }) => notice.id)).toEqual(ids.slice(0, 10));
  expect(first.hasMore).toBe(true);
  const second = await getJson(
    api,
    `/api/notifications?roadmapId=${roadmapId}&limit=10&after=${ids[9]}`,
  );
  expect(second.notifications.map((notice: { id: string }) => notice.id)).toEqual(ids.slice(10));
  expect(second.hasMore).toBe(false);
  await authenticateAs(page.context(), recipient.id);
  await page.addInitScript(() => {
    const realNow = Date.now.bind(Date);
    Date.now = () => realNow() + 86_400_000;
  });
  await page.goto(otherCourse.pagePath());
  await page.getByRole('button', { name: 'Avisos, 12 sin leer', exact: true }).click();
  await expect(
    page
      .getByRole('list', { name: 'Lista de avisos' })
      .getByRole('button', { name: /El Roadmap ha recibido 12 cambios\./ }),
  ).toBeVisible();
  const oldest = (await listNotices(api, { roadmapId, limit: 100 })).find(
    ({ id }) => id === ids[11],
  );
  expect(oldest).toMatchObject({ id: ids[11], read: false });
  expect(oldest).not.toHaveProperty('seen');
  const failRecognition = true;
  await page.route('**/api/notifications/acknowledge', async (route) => {
    if (failRecognition) {
      await route.abort();
      return;
    }
    await route.continue();
  });
  await page
    .getByRole('list', { name: 'Lista de avisos' })
    .getByRole('button', { name: course.courseName })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('No se pudieron reconocer algunos avisos.')).toHaveCount(0);
  expect((await getJson(api, `/api/notifications/counts?roadmapId=${roadmapId}`)).count).toBe(12);
});

test('Inbox query errors remain visible and can be retried', async ({ page, course }) => {
  await authenticateAs(page.context(), course.users.studentWithoutProgress.id);
  await page.route('**/api/notifications?*', (route) => route.fulfill({ status: 503, body: '{}' }));
  await page.goto('/academic-overview');
  await page.getByRole('button', { name: 'Avisos', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'No se pudieron cargar los avisos.' }),
  ).toBeVisible();
  await expect(page.getByText('No tienes avisos todavía.')).toHaveCount(0);
  await page.unroute('**/api/notifications?*');
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByText('No tienes avisos todavía.')).toBeVisible();
});

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`Inbox loading, retry and focus work by keyboard at ${viewport.width}px`, async ({
    page,
    course,
  }) => {
    await page.setViewportSize(viewport);
    await authenticateAs(page.context(), course.users.studentWithoutProgress.id);
    let release: () => void = () => undefined;
    const loading = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/notifications?*', async (route) => {
      await loading;
      await route.fulfill({ status: 503, body: '{}' });
    });
    await page.goto('/academic-overview');
    const bell = page.getByRole('button', { name: 'Avisos', exact: true });
    await bell.focus();
    await bell.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: 'Cargando avisos…' })).toBeVisible();
    release();
    await expect(
      page.getByRole('alert').filter({ hasText: 'No se pudieron cargar los avisos.' }),
    ).toBeVisible();
    await expect(page.getByText('No tienes avisos todavía.')).toHaveCount(0);
    await page.unroute('**/api/notifications?*');
    const retry = page.getByRole('button', { name: 'Reintentar', exact: true });
    await retry.focus();
    await retry.press('Enter');
    await expect(page.getByText('No tienes avisos todavía.')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(bell).toBeFocused();
    await expect(page.getByRole('link', { name: 'U-Roadmaps', exact: true })).toBeVisible();
  });
}

test('a PostgreSQL notification failure preserves the committed Roadmap and creation response', async ({
  course,
  apiAs,
  teacherApi,
  createCourse,
  rejectNoticeInserts,
}) => {
  const { teacher, multiCourseStudent } = course.users;
  const offering = await createCourse({
    roadmap: false,
    participants: [
      { user: teacher, role: 'TEACHER' },
      { user: multiCourseStudent, role: 'STUDENT' },
    ],
  });
  await rejectNoticeInserts({ courseOfferingId: offering.id });
  await ok(await teacherApi.post(offering.apiPath(), { data: {} }), 201);
  await ok(await teacherApi.get(offering.apiPath()));
  expect(await listNotices(await apiAs(multiCourseStudent), {})).toHaveLength(0);
});

async function getJson(api: APIRequestContext, path: string) {
  return (await api.get(path)).json();
}
