import { expect, test } from './fixtures';
import { authenticateAs } from './helpers';
import { literal, sql } from './database';

test('real SSE keeps student content stable while notices and counters update, including recovery', async ({
  browser,
  course,
}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL as string;
  const teacher = await browser.newContext({ baseURL });
  const student = await browser.newContext({ baseURL });
  let nodeId: string | undefined;
  try {
    await authenticateAs(teacher, course.users.teacher.id);
    await authenticateAs(student, course.users.studentWithoutProgress.id);
    const created = await teacher.request.post(course.apiPath('/nodes'), {
      data: {
        title: `SSE ${crypto.randomUUID()}`,
        description: 'Original SSE detail',
        nodeTypeId: '00000000-0000-4000-8000-000000000001',
        positionX: 350,
        positionY: 150,
      },
    });
    expect(created.status()).toBe(201);
    nodeId = (await created.json()).node.id;
    const teacherPage = await teacher.newPage();
    await teacherPage.goto(`${course.pagePath()}?targetNode=${nodeId}`);
    const page = await student.newPage();
    const other = await student.newPage();
    const stream = page.waitForResponse((response) =>
      response.url().endsWith('/api/notifications/stream'),
    );
    await page.goto(`${course.pagePath()}?targetNode=${nodeId}`);
    expect((await stream).headers()['content-type']).toContain('text/event-stream');
    await expect(page.getByText('Original SSE detail', { exact: true })).toBeVisible();
    await other.goto('/academic-overview');
    await other.getByRole('button', { name: /^Avisos(,|$)/ }).click();
    const filter = `nodeId=${nodeId}`;
    const count = async () =>
      (await (await student.request.get(`/api/notifications/counts?${filter}`)).json()).count;
    await expect.poll(count).toBe(0);
    const originalCounter = await other
      .getByRole('button', { name: /^Avisos(,|$)/ })
      .getAttribute('aria-label');
    const title = `Live SSE ${crypto.randomUUID()}`;
    // The edit is stored immediately (no grouping window or summary, see ADR-0014).
    const seenInOtherTab = page.waitForResponse(async (response) => {
      if (new URL(response.url()).pathname !== '/api/notifications' || !response.ok()) return false;
      const feed = await response.json();
      return feed.notifications.some(
        (notice: { subject: string; seen: boolean }) => notice.subject === title && notice.seen,
      );
    });
    await teacherPage.getByLabel('Título', { exact: true }).fill(title);
    await teacherPage.getByLabel('Descripción').fill('Delivered through real SSE');
    await teacherPage.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(other.getByRole('button', { name: new RegExp(title) })).toHaveCount(2);
    await expect(page.getByRole('button', { name: /^Avisos, [1-9]/ })).toBeVisible();
    await expect(page.getByText('Original SSE detail', { exact: true })).toBeVisible();
    await expect(page.getByText('Delivered through real SSE', { exact: true })).toBeHidden();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect.poll(() => count()).toBe(2);
    // Visibility in the other Inbox tab propagates seen state without recognition.
    expect((await seenInOtherTab).status()).toBe(200);
    // HTTP recognition in one tab must update the already open Inbox in another.
    const operation = {
      roadmapId: (await (await student.request.get(course.apiPath())).json()).roadmap.id,
      nodeId,
      operationId: crypto.randomUUID(),
    };
    expect(
      (await page.request.post('/api/notifications/openings', { data: operation })).status(),
    ).toBe(200);
    expect(
      (await page.request.post('/api/notifications/acknowledge', { data: operation })).status(),
    ).toBe(200);
    await expect.poll(count).toBe(0);
    await expect(other.getByRole('button', { name: /^Avisos(,|$)/ })).toHaveAttribute(
      'aria-label',
      originalCounter!,
    );
    await student.setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    expect(
      (
        await teacher.request.patch(course.apiPath(`/nodes/${nodeId}`), {
          data: { description: 'Recovered after reconnect' },
        })
      ).status(),
    ).toBe(200);
    const reconnected = page.waitForResponse((response) =>
      response.url().endsWith('/api/notifications/stream'),
    );
    await student.setOffline(false);
    expect((await reconnected).status()).toBe(200);
    await page.bringToFront();
    await expect.poll(() => count()).toBe(1);
    await expect(page.getByRole('button', { name: /^Avisos, [1-9]/ })).toBeVisible();
    await expect(page.getByText('Original SSE detail', { exact: true })).toBeVisible();
    await expect(page.getByText('Recovered after reconnect', { exact: true })).toBeHidden();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Clicking a notice on the same Roadmap is a new entry, despite client routing.
    await page.getByRole('button', { name: /^Avisos(,|$)/ }).click();
    await page
      .getByRole('button', { name: new RegExp(title) })
      .first()
      .click();
    await expect(page.getByText('Recovered after reconnect', { exact: true })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Entendido' }).click();
    await page.goto(`${course.pagePath()}?targetNode=${nodeId}`);
    await expect(page.getByText('Recovered after reconnect', { exact: true })).toBeVisible();
    expect(
      (
        await teacher.request.patch(course.apiPath(`/nodes/${nodeId}`), {
          data: { description: 'Actualizado al refrescar' },
        })
      ).status(),
    ).toBe(200);
    await expect.poll(count).toBe(1);
    await expect(page.getByText('Recovered after reconnect', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('Actualizado al refrescar', { exact: true })).toBeVisible();

    // Revocation still makes an authorized HTTP request and clears protected content.
    const denied = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === course.apiPath() && response.status() === 403,
    );
    await sql(`UPDATE "Participation" SET "isActive" = false
      WHERE "courseOfferingId" = ${literal(course.id)}
      AND "userId" = ${literal(course.users.studentWithoutProgress.id)};`);
    expect((await denied).status()).toBe(403);
    await expect(page).toHaveURL(/academic-overview\?accessLost=1/);
    await expect(page.getByText('Actualizado al refrescar', { exact: true })).toBeHidden();
  } finally {
    // eslint-disable-next-line playwright/no-conditional-in-test
    if (nodeId) await teacher.request.delete(course.apiPath(`/nodes/${nodeId}`));
    await student.close();
    await teacher.close();
  }
});

test('the SSE endpoint requires an authenticated User', async ({ request }) => {
  expect((await request.get('/api/notifications/stream')).status()).toBe(401);
});
