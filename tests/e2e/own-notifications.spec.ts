import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { insert, sql } from './database';
import { expect, test } from './fixtures';
import { authenticateAs, sessionCookie } from './helpers';

test('own Inbox requires authentication and isolates notice identities', async ({
  request,
  page,
  course,
}) => {
  const user = course.users.studentWithoutProgress.id;
  expect((await request.get('/api/notifications')).status()).toBe(401);
  const headers = { cookie: await sessionCookie(user) };
  const response = await request.get('/api/notifications', { headers });
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ notifications: [], hasMore: false });
  expect(
    (
      await request.get('/api/notifications/00000000-0000-4000-8000-000000000001', { headers })
    ).status(),
  ).toBe(404);
  await authenticateAs(page.context(), user);
  await page.goto('/academic-overview');
  await page.getByRole('button', { name: 'Avisos', exact: true }).click();
  await expect(page.getByText('No tienes avisos todavía.')).toBeVisible();
});

test('Roadmap creation persists one own notice for each eligible Participation and browser opening recognizes it', async ({
  request,
  page,
  course,
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
  const author = { cookie: await sessionCookie(teacher.id) };
  const path = offering.apiPath();
  const created = await request.post(path, { headers: author, data: {} });
  expect(created.status()).toBe(201);
  const roadmapId = (await created.json()).roadmap.id;
  expect((await request.post(path, { headers: author, data: {} })).status()).toBe(409);
  for (const { id } of Object.values(course.users)) {
    const eligible = [teachingAssistant.id, multiCourseStudent.id, studentWithoutProgress.id];
    await expect
      .poll(
        async () =>
          (
            await (
              await request.get(`/api/notifications?roadmapId=${roadmapId}`, {
                headers: { cookie: await sessionCookie(id) },
              })
            ).json()
          ).notifications.length,
        { message: `audience for ${id}` },
      )
      .toBe(eligible.includes(id) ? 1 : 0);
    const response = await request.get(`/api/notifications?roadmapId=${roadmapId}`, {
      headers: { cookie: await sessionCookie(id) },
    });
    expect(response.status()).toBe(200);
    const notices = (await response.json()).notifications;
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
  const newcomerHeaders = { cookie: await sessionCookie(outsider.id) };
  expect(
    (await getJson(request, '/api/notifications', newcomerHeaders)).notifications,
  ).toHaveLength(0);
  const recipient = { cookie: await sessionCookie(multiCourseStudent.id) };
  const first = (await getJson(request, `/api/notifications?roadmapId=${roadmapId}`, recipient))
    .notifications[0];
  const subject = `Roadmap disponible: ${offering.courseCode}`;
  expect(first).toMatchObject({ subject, read: false });
  expect((await request.get(`/api/notifications/${first.id}`, { headers: author })).status()).toBe(
    404,
  );
  expect(
    (
      await request.patch(`/api/notifications/${first.id}`, {
        headers: author,
        data: { action: 'read', recipientId: multiCourseStudent.id },
      })
    ).status(),
  ).toBe(405);
  await authenticateAs(page.context(), multiCourseStudent.id);
  await page.goto(course.pagePath());
  await page.getByRole('button', { name: 'Avisos, 1 sin leer', exact: true }).click();
  const row = page.getByRole('button', { name: new RegExp(subject) });
  await expect(row).toBeVisible();
  expect(await getJson(request, `/api/notifications/${first.id}`, recipient)).not.toHaveProperty(
    'seen',
  );
  expect((await getJson(request, `/api/notifications/${first.id}`, recipient)).read).toBe(false);
  await row.click();
  await expect(page).toHaveURL(offering.pagePath());
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect
    .poll(async () => (await getJson(request, `/api/notifications/${first.id}`, recipient)).read)
    .toBe(true);
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const persisted = await request.get(`/api/notifications/${first.id}`, { headers: recipient });
  expect(await persisted.json()).toMatchObject({ id: first.id, read: true });
});

test('pagination, visible rows, retry and opening cutoff preserve late arrivals', async ({
  request,
  page,
  course,
  createCourse,
}) => {
  const { roadmapId, courseCode } = course;
  const recipient = course.users.multiCourseStudent;
  const otherCourse = await createCourse({
    participants: [{ user: recipient, role: 'STUDENT' }],
  });
  const headers = { cookie: await sessionCookie(recipient.id) };
  const subject = `Roadmap disponible: ${courseCode}`;
  const seed = (id: string, availableAt: Date) =>
    sql(
      insert('RoadmapNotice', [
        {
          id,
          eventId: `e2e-inbox-${id}`,
          recipientId: recipient.id,
          roadmapId,
          courseOfferingId: course.id,
          subject,
          body: 'Aviso de prueba',
          data: JSON.stringify({
            roadmapId,
            courseCode,
            year: course.year,
            semester: course.semester,
            targetKind: 'roadmap',
            changeKind: 'roadmap-available',
            occurredAt: '2026-10-01T12:00:00.000Z',
            eventCount: 1,
            actorName: 'Daniela',
          }),
          occurredAt: new Date(),
          availableAt,
        },
      ]),
    );
  const ids = Array.from({ length: 12 }, () => randomUUID())
    .sort()
    .reverse();
  for (const id of ids) await seed(id, new Date('2026-01-01T00:00:00Z'));
  const first = await getJson(
    request,
    `/api/notifications?roadmapId=${roadmapId}&limit=10`,
    headers,
  );
  expect(first.notifications.map((notice: { id: string }) => notice.id)).toEqual(ids.slice(0, 10));
  expect(first.hasMore).toBe(true);
  const second = await getJson(
    request,
    `/api/notifications?roadmapId=${roadmapId}&limit=10&after=${ids[9]}`,
    headers,
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
  await expect(page.getByRole('button', { name: 'Cargar más avisos' })).toBeVisible();
  expect(await getJson(request, `/api/notifications/${ids[11]}`, headers)).not.toHaveProperty(
    'seen',
  );
  let failRecognition = true;
  await page.route('**/api/notifications/acknowledge', async (route) => {
    if (failRecognition) {
      await route.abort();
      return;
    }
    await route.continue();
  });
  await page
    .getByRole('button', { name: new RegExp(subject) })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('No se pudieron reconocer algunos avisos.')).toBeVisible();
  expect(
    (await getJson(request, `/api/notifications/counts?roadmapId=${roadmapId}`, headers)).count,
  ).toBe(12);
  const lateId = randomUUID();
  await seed(lateId, new Date(Date.now() - 5 * 60_000));

  failRecognition = false;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await getJson(request, `/api/notifications/counts?roadmapId=${roadmapId}`, headers)).count,
    )
    .toBe(1);
  expect((await getJson(request, `/api/notifications/${ids[11]}`, headers)).read).toBe(true);
  expect((await getJson(request, `/api/notifications/${lateId}`, headers)).read).toBe(false);
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
  request,
  course,
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
  // The Roadmap does not exist yet, so the failure is scoped to its Course offering.
  await rejectNoticeInserts({ courseOfferingId: offering.id });
  const headers = { cookie: await sessionCookie(teacher.id) };
  const created = await request.post(offering.apiPath(), { headers, data: {} });
  expect(created.status()).toBe(201);
  expect((await request.get(offering.apiPath(), { headers })).status()).toBe(200);
  const recipient = { cookie: await sessionCookie(multiCourseStudent.id) };
  expect((await getJson(request, '/api/notifications', recipient)).notifications).toHaveLength(0);
});

async function getJson(request: APIRequestContext, path: string, headers: { cookie: string }) {
  return (await request.get(path, { headers })).json();
}
