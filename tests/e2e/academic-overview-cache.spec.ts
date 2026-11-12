import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { test, expect, type E2EUser } from './fixtures';
import { authenticateAs, ok } from './helpers';
import { academicHistoryRequests, controlAcademicHistory, failUcampusEndpoint } from './ucampus';
import { insert, literal, sql } from './database';
import {
  ACADEMIC_CACHE_PREFIX,
  ACADEMIC_CACHE_LIFETIME_MS,
} from '@/features/academic-overview/domain/browser-cache';

async function visit(page: Page, user: E2EUser) {
  await authenticateAs(page.context(), user.id);
  await page.goto('/academic-overview');
  await expect(page.getByRole('button', { name: 'Actualizar cursos', exact: true })).toBeEnabled();
}

async function cacheText(page: Page, user: E2EUser) {
  return page.evaluate((key) => localStorage.getItem(key), ACADEMIC_CACHE_PREFIX + user.id);
}

async function warmReload(page: Page) {
  await page.reload();
  await expect(
    page.getByText('Cursos guardados en este navegador.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Actualizar cursos', exact: true })).toBeEnabled();
}

test('cold synchronization stores only presentation fields and a warm reload makes no institutional request', async ({
  page,
  course,
  reportPosition,
}) => {
  const user = course.users.studentWithoutProgress;
  await reportPosition(user, course, null);
  await visit(page, user);
  await expect(page.getByText(course.courseName, { exact: true })).toBeVisible();
  expect(await academicHistoryRequests(user)).toBe(2);
  const stored = JSON.parse((await cacheText(page, user))!);
  expect(stored).toMatchObject({ version: 1, userId: user.id });
  expect(stored.expiresAt - stored.synchronizedAt).toBe(ACADEMIC_CACHE_LIFETIME_MS);
  expect(stored.courses[0]).toEqual({
    courseCode: course.courseCode,
    name: course.courseName,
    year: course.year,
    semester: course.semester,
    section: null,
  });
  expect(JSON.stringify(stored)).not.toContain(user.rut);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Actualizar cursos', exact: true })).toBeEnabled();
  expect(await academicHistoryRequests(user)).toBe(2);
  await expect(
    page.getByText('Cursos guardados en este navegador.', { exact: false }),
  ).toBeVisible();
  expect(JSON.parse((await cacheText(page, user))!)).toEqual(stored);
  await expect(
    page.getByText('No pudimos actualizar tus cursos desde U-Campus.', { exact: false }),
  ).toHaveCount(0);
});

test('expiration and explicit refresh request new history', async ({
  page,
  course,
  reportPosition,
}) => {
  const user = course.users.studentWithoutProgress;
  await reportPosition(user, course, null);
  await visit(page, user);
  await page.evaluate(
    ({ key, lifetime }) => {
      const cached = JSON.parse(localStorage.getItem(key)!);
      cached.synchronizedAt = Date.now() - lifetime - 1000;
      cached.expiresAt = cached.synchronizedAt + lifetime;
      localStorage.setItem(key, JSON.stringify(cached));
    },
    { key: ACADEMIC_CACHE_PREFIX + user.id, lifetime: ACADEMIC_CACHE_LIFETIME_MS },
  );
  await page.reload();
  await expect(page.getByRole('button', { name: 'Actualizar cursos', exact: true })).toBeEnabled();
  expect(await academicHistoryRequests(user)).toBe(4);
  await page.getByRole('button', { name: 'Actualizar cursos', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Actualizar cursos', exact: true })).toBeEnabled();
  expect(await academicHistoryRequests(user)).toBe(6);
});

test('two cold tabs share synchronization and concurrent HTTP refreshes are deduplicated on the server', async ({
  page,
  course,
  reportPosition,
  apiAs,
}) => {
  const user = course.users.studentWithoutProgress;
  await reportPosition(user, course, null);
  await controlAcademicHistory(user, { delayMs: 500 });
  await authenticateAs(page.context(), user.id);
  const other = await page.context().newPage();
  await Promise.all([page.goto('/academic-overview'), other.goto('/academic-overview')]);
  await expect(page.getByRole('button', { name: 'Actualizar cursos', exact: true })).toBeEnabled();
  await expect(other.getByRole('button', { name: 'Actualizar cursos', exact: true })).toBeEnabled();
  expect(await academicHistoryRequests(user)).toBe(2);
  await Promise.all([
    page.getByRole('button', { name: 'Actualizar cursos', exact: true }).click(),
    other.getByRole('button', { name: 'Actualizar cursos', exact: true }).click(),
  ]);
  await expect(page.getByRole('button', { name: 'Actualizar cursos', exact: true })).toBeEnabled();
  await expect(other.getByRole('button', { name: 'Actualizar cursos', exact: true })).toBeEnabled();
  expect(await academicHistoryRequests(user)).toBe(4);
  const api = await apiAs(user);
  const responses = await Promise.all([
    api.post('/api/academic-overview/browser'),
    api.get('/api/academic-overview'),
    api.post('/api/academic-overview/browser'),
    api.get('/api/academic-overview'),
  ]);
  for (const response of responses) await ok(response);
  expect(await academicHistoryRequests(user)).toBe(6);
  await other.close();
});

test('warm history keeps local progress and newly created Roadmaps current', async ({
  page,
  course,
  createCourse,
  reportPosition,
  apiAs,
}) => {
  const user = course.users.studentWithoutProgress;
  const offering = await createCourse({
    roadmap: false,
    participants: [
      { user, role: 'STUDENT' },
      { user: course.users.teacher, role: 'TEACHER', institutionalPosition: 'COURSE_PROFESSOR' },
    ],
  });
  await reportPosition(user, course, null);
  await reportPosition(user, offering, null);
  await visit(page, user);
  const row = page.getByRole('listitem').filter({ hasText: course.courseCode });
  await expect(row).toContainText('Aún no completas nodos');
  await sql(
    insert('Completion', [
      {
        id: randomUUID(),
        userId: user.id,
        roadmapNodeId: course.nodes.first,
        completedAt: new Date(),
      },
    ]),
  );
  const teacher = await apiAs(course.users.teacher);
  await ok(await teacher.post(offering.apiPath(), { data: {} }), 201);
  await warmReload(page);
  await expect(row).toContainText('1 de');
  await expect(
    page.getByRole('link', { name: `Abrir roadmap de ${offering.courseName}` }),
  ).toBeVisible();
  expect(await academicHistoryRequests(user)).toBe(2);
});

test('account changes separate histories, notify other tabs, and logout removes the cache', async ({
  page,
  course,
  createUser,
  createCourse,
  reportPosition,
}) => {
  const first = course.users.studentWithoutProgress;
  const second = await createUser();
  const offering = await createCourse({ participants: [{ user: second, role: 'STUDENT' }] });
  await reportPosition(first, course, null);
  await reportPosition(second, offering, null);
  await visit(page, first);
  const other = await page.context().newPage();
  await other.goto('/academic-overview');
  await expect(
    other.getByText('Cursos guardados en este navegador.', { exact: false }),
  ).toBeVisible();
  await visit(page, second);
  await expect(page.getByText(offering.courseName, { exact: true })).toBeVisible();
  await expect(page.getByText(course.courseName, { exact: true })).toHaveCount(0);
  expect(await cacheText(page, first)).toBeNull();
  await expect(other.getByText(offering.courseName, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Cerrar sesión', exact: true })
    .click();
  await expect(page).toHaveURL('/');
  expect(await cacheText(page, second)).toBeNull();
  await other.close();
});

const storageScenarios = {
  malformed: async (page: Page, user: E2EUser) =>
    page.addInitScript(
      (key) => localStorage.setItem(key, '{broken'),
      ACADEMIC_CACHE_PREFIX + user.id,
    ),
  incompatible: async (page: Page, user: E2EUser) =>
    page.addInitScript(
      (key) => localStorage.setItem(key, JSON.stringify({ version: 999 })),
      ACADEMIC_CACHE_PREFIX + user.id,
    ),
  unavailable: async (page: Page) =>
    page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('Unavailable', 'SecurityError');
        },
      });
    }),
  full: async (page: Page) =>
    page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('Full', 'QuotaExceededError');
      };
    }),
};

for (const [storage, prepare] of Object.entries(storageScenarios)) {
  test(`${storage} storage still renders courses`, async ({ page, course, reportPosition }) => {
    const user = course.users.studentWithoutProgress;
    await reportPosition(user, course, null);
    await prepare(page, user);
    await visit(page, user);
    await expect(page.getByText(course.courseName, { exact: true })).toBeVisible();
    expect(await academicHistoryRequests(user)).toBe(2);
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Actualizar cursos', exact: true }),
    ).toBeEnabled();
    await expect(page.getByText(course.courseName, { exact: true })).toBeVisible();
    expect(await academicHistoryRequests(user)).toBe(4);
  });
}

test('partial and unavailable refreshes preserve a complete cache and omitted active courses, then recover', async ({
  page,
  course,
  createCourse,
  reportPosition,
  apiAs,
}) => {
  const user = course.users.teacher;
  const offering = await createCourse({
    roadmap: false,
    participants: [{ user, role: 'TEACHER', institutionalPosition: 'COURSE_PROFESSOR' }],
  });
  await reportPosition(user, course, 'COURSE_PROFESSOR');
  await visit(page, user);
  const complete = await cacheText(page, user);
  await failUcampusEndpoint(user, 'cursos_dictados');
  await page.getByRole('button', { name: 'Actualizar cursos', exact: true }).click();
  await expect(
    page.getByText('U-Campus respondió de forma parcial.', { exact: false }),
  ).toBeVisible();
  expect(await cacheText(page, user)).toBe(complete);
  await expect(
    page.getByRole('button', { name: `Crear roadmap de ${offering.courseName}` }),
  ).toBeVisible();
  const api = await apiAs(user);
  await ok(await api.get(course.apiPath('/simulation')));
  await failUcampusEndpoint(user, 'cursos_inscritos');
  await page.getByRole('button', { name: 'Actualizar cursos', exact: true }).click();
  await expect(
    page.getByText('No pudimos actualizar tus cursos desde U-Campus.', { exact: false }),
  ).toBeVisible();
  expect(await cacheText(page, user)).toBe(complete);
  await controlAcademicHistory(user, { recover: true });
  await page.getByRole('button', { name: 'Actualizar cursos', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Actualizar cursos', exact: true })).toBeEnabled();
  await expect(
    page.getByText('No pudimos actualizar tus cursos desde U-Campus.', { exact: false }),
  ).toHaveCount(0);
  expect(await cacheText(page, user)).not.toBe(complete);
});

test('stale and tampered browser information never grants server permissions or revives a withdrawn Participation', async ({
  page,
  course,
  reportPosition,
  apiAs,
}) => {
  const user = course.users.studentWithoutProgress;
  await reportPosition(user, course, null);
  await visit(page, user);
  await page.evaluate((key) => {
    const value = JSON.parse(localStorage.getItem(key)!);
    value.courses[0].role = 'TEACHER';
    value.courses[0].institutionalPosition = 'COURSE_PROFESSOR';
    value.courses[0].canCreateRoadmap = true;
    localStorage.setItem(key, JSON.stringify(value));
  }, ACADEMIC_CACHE_PREFIX + user.id);
  const api = await apiAs(user);
  await ok(
    await api.patch(course.apiPath(`/nodes/${course.nodes.first}`), {
      data: { title: 'Unauthorized' },
    }),
    403,
  );
  await sql(
    `UPDATE "Participation" SET "isActive"=false WHERE "userId"=${literal(user.id)} AND "courseOfferingId"=${literal(course.id)};`,
  );
  await warmReload(page);
  await expect(page.getByText(course.courseName, { exact: true })).toHaveCount(0);
  await expect(
    page.getByText('No tienes cursos activos en U-Roadmaps.', { exact: false }),
  ).toBeVisible();
  await ok(await api.get(course.apiPath()), 403);
  expect(await academicHistoryRequests(user)).toBe(2);
});

test('loading, institutional failure and recovery retain the desktop and mobile presentation', async ({
  page,
  course,
  reportPosition,
}, testInfo) => {
  const user = course.users.studentWithoutProgress;
  await reportPosition(user, course, null);
  await controlAcademicHistory(user, { delayMs: 1500 });
  await failUcampusEndpoint(user, 'cursos_inscritos');
  await failUcampusEndpoint(user, 'cursos_dictados');
  await page.setViewportSize({ width: 1440, height: 900 });
  await authenticateAs(page.context(), user.id);
  const synchronization = page.waitForRequest(
    (request) =>
      request.url().endsWith('/api/academic-overview/browser') && request.method() === 'POST',
  );
  await page.goto('/academic-overview');
  await synchronization;
  await expect(page.getByRole('status', { name: 'Cargando resumen académico...' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Licencias de terceros' })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('stable-loading-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('stable-loading-mobile.png') });
  await expect(
    page.getByText('No pudimos actualizar tus cursos desde U-Campus.', { exact: false }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('stable-failure-mobile.png') });
  await controlAcademicHistory(user, { recover: true });
  await page.getByRole('button', { name: 'Actualizar cursos', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Actualizar cursos', exact: true })).toBeEnabled();
  await expect(page.getByText(course.courseName, { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Licencias de terceros' })).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('stable-overview-mobile.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: testInfo.outputPath('stable-overview-desktop.png') });
});

test('browser endpoints require authentication and ignore client-supplied history', async ({
  request,
  course,
  reportPosition,
  apiAs,
}) => {
  for (const response of [
    await request.get('/api/academic-overview/browser'),
    await request.post('/api/academic-overview/browser'),
  ])
    await ok(response, 401);
  const user = course.users.studentWithoutProgress;
  await reportPosition(user, course, null);
  const api = await apiAs(user);
  const result = await ok(
    await api.post('/api/academic-overview/browser', {
      data: {
        userId: course.users.teacher.id,
        history: {
          status: 'complete',
          courses: [{ ...course, institutionalPosition: 'COURSE_PROFESSOR' }],
        },
        expiresAt: 9999999999999,
      },
    }),
  );
  expect(await result.json()).toMatchObject({
    userId: user.id,
    overview: {
      terms: [{ courses: [{ institutionalPosition: 'STUDENT', canCreateRoadmap: false }] }],
    },
  });
  await ok(await api.get(course.apiPath('/simulation')), 403);
});

test('an unavailable cold history remains uncached and retries on the next visit', async ({
  page,
  course,
  reportPosition,
}) => {
  const user = course.users.studentWithoutProgress;
  await reportPosition(user, course, null);
  await failUcampusEndpoint(user, 'cursos_dictados');
  await failUcampusEndpoint(user, 'cursos_inscritos');
  await visit(page, user);
  await expect(page.getByText(course.courseName, { exact: true })).toBeVisible();
  await expect(
    page.getByText('No pudimos actualizar tus cursos desde U-Campus.', { exact: false }),
  ).toBeVisible();
  expect(await cacheText(page, user)).toBeNull();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Actualizar cursos', exact: true })).toBeEnabled();
  expect(await academicHistoryRequests(user)).toBe(4);
});

test('a warm stored position explains creation rights without claiming a failed institutional check', async ({
  page,
  course,
  createCourse,
  reportPosition,
}) => {
  const user = course.users.teacher;
  const offering = await createCourse({
    roadmap: false,
    participants: [{ user, role: 'TEACHER', institutionalPosition: 'COORDINATING_PROFESSOR' }],
  });
  await reportPosition(user, offering, 'COORDINATING_PROFESSOR');
  await visit(page, user);
  await warmReload(page);
  const row = page.getByRole('listitem').filter({ hasText: offering.courseCode });
  await expect(row).toContainText('Solo el profesor de cátedra puede crear el roadmap.');
  await expect(row).not.toContainText('No pudimos confirmar');
  expect(await academicHistoryRequests(user)).toBe(2);
});
