import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { authenticateAs, ok } from './helpers';
import { countNotices, findNode, openInbox, storeTitleNotices } from './notices';

const bell = (page: Page) => page.getByRole('button', { name: /^Avisos(,|$)/ });
const noticeRows = (page: Page) =>
  page.getByRole('list', { name: 'Lista de avisos' }).getByRole('button');

test('a new notice appears only after a page load, with bell and list agreeing', async ({
  page,
  course,
  teacherApi: author,
  studentApi: recipient,
}) => {
  await authenticateAs(page.context(), course.users.studentWithoutProgress.id);
  await page.goto('/academic-overview');
  await expect(bell(page)).toHaveAttribute('aria-label', 'Avisos');

  const roadmap = await (await author.get(course.apiPath())).json();
  const node = findNode(roadmap, course.nodes.first);
  await ok(
    await author.patch(course.apiPath(`/nodes/${node.id}`), {
      data: { title: `${node.title} renombrado` },
    }),
  );
  await expect.poll(() => countNotices(recipient, `roadmapId=${course.roadmapId}`)).toBe(1);

  await openInbox(page);
  await expect(page.getByText('No tienes avisos todavía.')).toBeVisible();
  await expect(bell(page)).toHaveAttribute('aria-label', 'Avisos');
  await page.keyboard.press('Escape');

  await page.reload();
  await expect(bell(page)).toHaveAttribute('aria-label', 'Avisos, 1 sin leer');
  await expect(
    page.getByRole('button', { name: `1 avisos sin leer para el curso ${course.courseName}` }),
  ).toBeVisible();
  await openInbox(page);
  await expect(noticeRows(page)).toHaveCount(1);
});

test('loading the academic overview and opening the bell request no notifications', async ({
  page,
  course,
}) => {
  await storeTitleNotices(course, course.users.studentWithoutProgress.id, 2);
  const notificationReads: string[] = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith('/api/notifications') && pathname !== '/api/notifications/stream')
      notificationReads.push(`${request.method()} ${pathname}`);
  });
  await authenticateAs(page.context(), course.users.studentWithoutProgress.id);
  await page.goto('/academic-overview');
  await expect(bell(page)).toHaveAttribute('aria-label', 'Avisos, 2 sin leer');
  await openInbox(page);
  await expect(noticeRows(page)).toHaveCount(2);
  await page.keyboard.press('Escape');
  await openInbox(page, `2 avisos sin leer para el curso ${course.courseName}`);
  await expect(noticeRows(page)).toHaveCount(2);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(bell(page)).toHaveAttribute('aria-label', 'Avisos, 2 sin leer');
  expect(notificationReads).toEqual([]);
});

test('entering a Roadmap clears its bell and course counts without a reload, also after going back', async ({
  page,
  course,
  createCourse,
}) => {
  const student = course.users.studentWithoutProgress;
  const other = await createCourse({ participants: [{ user: student, role: 'STUDENT' }] });
  await storeTitleNotices(course, student.id, 2);
  await storeTitleNotices({ ...other, roadmapId: other.roadmapId! }, student.id, 1);
  await authenticateAs(page.context(), student.id);
  await page.goto('/academic-overview');
  const courseCount = page.getByRole('button', {
    name: `2 avisos sin leer para el curso ${course.courseName}`,
  });
  await expect(bell(page)).toHaveAttribute('aria-label', 'Avisos, 3 sin leer');
  await expect(courseCount).toBeVisible();

  const acknowledged = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/notifications/acknowledge') &&
      response.request().method() === 'POST',
  );
  await openInbox(page, `2 avisos sin leer para el curso ${course.courseName}`);
  await noticeRows(page).first().click();
  await expect(page).toHaveURL(course.pagePath());
  expect((await acknowledged).status()).toBe(200);
  await expect(bell(page)).toHaveAttribute('aria-label', 'Avisos, 1 sin leer');

  await page.goBack();
  await expect(page).toHaveURL(/\/academic-overview$/);
  await expect(bell(page)).toHaveAttribute('aria-label', 'Avisos, 1 sin leer');
  await expect(page.getByRole('button', { name: /avisos sin leer para el curso/ })).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: `1 avisos sin leer para el curso ${other.courseName}` }),
  ).toBeVisible();
  await openInbox(page);
  await expect(noticeRows(page)).toHaveCount(1);
});

test('the SSE endpoint requires an authenticated User', async ({ request }) => {
  expect((await request.get('/api/notifications/stream')).status()).toBe(401);
});
