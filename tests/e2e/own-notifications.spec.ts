import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { developmentFixtureIds } from '@/development';
import { expect, test } from '@playwright/test';
import { authenticateAs, fixture, sessionCookie } from './helpers';

test('own Inbox requires authentication and isolates notice identities', async ({
  request,
  page,
}) => {
  expect((await request.get('/api/notifications')).status()).toBe(401);
  const headers = { cookie: await sessionCookie(fixture.camila) };
  const response = await request.get('/api/notifications', { headers });
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ notifications: [], hasMore: false });
  expect(
    (
      await request.get('/api/notifications/00000000-0000-4000-8000-000000000001', { headers })
    ).status(),
  ).toBe(404);
  await authenticateAs(page.context(), fixture.camila);
  await page.goto('/academic-overview');
  await page.getByRole('button', { name: 'Avisos', exact: true }).click();
  await expect(page.getByText('No tienes avisos todavía.')).toBeVisible();
});

test('Roadmap creation persists one own notice for each eligible Participation and browser opening recognizes it', async ({
  request,
  page,
}) => {
  cleanupAvailabilityFixture();
  const outsider = '90000153-0000-4000-8000-000000000001';
  fixtureSql(
    `INSERT INTO "User" ("id", "name", "institutionalEmail") VALUES ('${outsider}', 'Usuario ajeno', 'issue153-outsider@u-roadmaps.test') ON CONFLICT DO NOTHING;`,
  );
  try {
    const author = { cookie: await sessionCookie(fixture.daniela) };
    const path = '/api/FI1001/2026/2/roadmap';
    const created = await request.post(path, { headers: author, data: {} });
    expect(created.status()).toBe(201);
    const roadmapId = (await created.json()).roadmap.id;
    expect((await request.post(path, { headers: author, data: {} })).status()).toBe(409);
    const ids = [
      fixture.daniela,
      fixture.nicolas,
      fixture.camila,
      outsider,
      ...Array.from(
        { length: 50 },
        (_, index) => `20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      ),
    ];
    for (const id of ids) {
      const response = await request.get(`/api/notifications?roadmapId=${roadmapId}`, {
        headers: { cookie: await sessionCookie(id) },
      });
      expect(response.status()).toBe(200);
      const notices = (await response.json()).notifications;
      const eligible = ![
        fixture.daniela,
        fixture.camila,
        fixture.fi1001CurrentWithdrawnStudent,
        outsider,
      ].includes(id);
      expect(notices, `audience for ${id}`).toHaveLength(eligible ? 1 : 0);
    }
    fixtureSql(
      `INSERT INTO "Participation" ("id", "userId", "courseOfferingId", "role", "isActive") VALUES ('90000153-0000-4000-8000-000000000002', '${outsider}', '${developmentFixtureIds.offerings.fi1001Current}', 'STUDENT', true);`,
    );
    const newcomerHeaders = { cookie: await sessionCookie(outsider) };
    expect(
      (await (await request.get('/api/notifications', { headers: newcomerHeaders })).json())
        .notifications,
    ).toHaveLength(0);
    const recipient = { cookie: await sessionCookie(fixture.nicolas) };
    const first = (
      await (
        await request.get(`/api/notifications?roadmapId=${roadmapId}`, { headers: recipient })
      ).json()
    ).notifications[0];
    expect(first).toMatchObject({
      subject: 'Roadmap disponible: FI1001',
      read: false,
      seen: false,
    });
    expect(
      (await request.get(`/api/notifications/${first.id}`, { headers: author })).status(),
    ).toBe(404);
    expect(
      (
        await request.patch(`/api/notifications/${first.id}`, {
          headers: author,
          data: { action: 'read', recipientId: fixture.nicolas },
        })
      ).status(),
    ).toBe(404);
    await authenticateAs(page.context(), fixture.nicolas);
    await page.goto('/courses/CC1002/2026/2');
    await page.getByRole('button', { name: 'Avisos, 1 sin leer', exact: true }).click();
    const row = page.getByRole('button', { name: /Roadmap disponible: FI1001/ });
    await expect(row).toBeVisible();
    await expect
      .poll(
        async () =>
          (
            await (
              await request.get(`/api/notifications/${first.id}`, { headers: recipient })
            ).json()
          ).seen,
      )
      .toBe(true);
    expect(
      (await (await request.get(`/api/notifications/${first.id}`, { headers: recipient })).json())
        .read,
    ).toBe(false);
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/courses/FI1001/2026/2\\?notice=${first.id}`));
    await expect(page.getByRole('dialog', { name: 'Roadmap disponible: FI1001' })).toBeVisible();
    await expect
      .poll(
        async () =>
          (
            await (
              await request.get(`/api/notifications/${first.id}`, { headers: recipient })
            ).json()
          ).read,
      )
      .toBe(true);
    await page.reload();
    await expect(page.getByRole('dialog', { name: 'Roadmap disponible: FI1001' })).toBeVisible();
    const persisted = await request.get(`/api/notifications/${first.id}`, { headers: recipient });
    expect(await persisted.json()).toMatchObject({ id: first.id, read: true, seen: true });
  } finally {
    cleanupAvailabilityFixture();
    fixtureSql(`DELETE FROM "User" WHERE "id" = '${outsider}';`);
  }
});

// Fixture cleanup only: assertions and all Roadmap mutations use authenticated APIs.
function fixtureSql(sql: string) {
  const connection =
    process.env.E2E_DATABASE_URL ?? parse(readFileSync('.env.development')).E2E_DATABASE_URL;
  if (!connection || new URL(connection).pathname !== '/roadmap_e2e_db')
    throw new Error('Expected the local E2E database.');
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-c', sql], {
    stdio: 'pipe',
    env: {
      ...process.env,
      PGDATABASE: 'roadmap_e2e_db',
      PGHOST: new URL(connection).hostname,
      PGPORT: new URL(connection).port || '5432',
      PGUSER: decodeURIComponent(new URL(connection).username),
      PGPASSWORD: decodeURIComponent(new URL(connection).password),
    },
  });
}
function cleanupAvailabilityFixture() {
  const offeringId = developmentFixtureIds.offerings.fi1001Current;
  fixtureSql(`DELETE FROM "NoticeAcknowledgement" WHERE "roadmapId" IN (SELECT "id" FROM "Roadmap" WHERE "courseOfferingId" = '${offeringId}');
    DELETE FROM "RoadmapNotice" WHERE "courseOfferingId" = '${offeringId}';
    DELETE FROM "Roadmap" WHERE "courseOfferingId" = '${offeringId}';`);
}

test('pagination, visible rows, retry and opening cutoff preserve late arrivals', async ({
  request,
  page,
}) => {
  const roadmapId = developmentFixtureIds.roadmaps.cc1002;
  const headers = { cookie: await sessionCookie(fixture.nicolas) };
  const seed = (id: string, availableAt: string) =>
    fixtureSql(`INSERT INTO "RoadmapNotice" ("id", "eventId", "recipientId", "roadmapId", "courseOfferingId", "subject", "body", "data", "occurredAt", "availableAt") VALUES
    ('${id}', 'e2e-153-${id}', '${fixture.nicolas}', '${roadmapId}', '${developmentFixtureIds.offerings.cc1002}', 'Roadmap disponible: CC1002', 'Aviso de prueba', '{"roadmapId":"${roadmapId}","courseCode":"CC1002","year":2026,"semester":2,"targetKind":"roadmap","changeKind":"roadmap-available","occurredAt":"2026-10-01T12:00:00.000Z","eventCount":1,"actorName":"Daniela"}', NOW(), ${availableAt});`);
  const cleanup = () =>
    fixtureSql(
      `DELETE FROM "RoadmapNotice" WHERE "eventId" LIKE 'e2e-153-%'; DELETE FROM "NoticeAcknowledgement" WHERE "recipientId" = '${fixture.nicolas}' AND "roadmapId" = '${roadmapId}';`,
    );
  cleanup();
  try {
    const ids = Array.from({ length: 12 }, () => crypto.randomUUID())
      .sort()
      .reverse();
    for (const id of ids) seed(id, "'2026-01-01T00:00:00Z'");
    const first = await (
      await request.get(`/api/notifications?roadmapId=${roadmapId}&limit=10`, { headers })
    ).json();
    expect(first.notifications.map((notice: { id: string }) => notice.id)).toEqual(
      ids.slice(0, 10),
    );
    expect(first.hasMore).toBe(true);
    const second = await (
      await request.get(`/api/notifications?roadmapId=${roadmapId}&limit=10&after=${ids[9]}`, {
        headers,
      })
    ).json();
    expect(second.notifications.map((notice: { id: string }) => notice.id)).toEqual(ids.slice(10));
    expect(second.hasMore).toBe(false);
    await authenticateAs(page.context(), fixture.nicolas);
    await page.addInitScript(() => {
      const realNow = Date.now.bind(Date);
      Date.now = () => realNow() + 86_400_000;
    });
    await page.goto('/courses/MA1001/2026/2');
    await page.getByRole('button', { name: 'Avisos, 12 sin leer', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Cargar más avisos' })).toBeVisible();
    expect(
      (await (await request.get(`/api/notifications/${ids[11]}`, { headers })).json()).seen,
    ).toBe(false);
    let failRecognition = true;
    await page.route('**/api/notifications/acknowledge', async (route) => {
      if (failRecognition) {
        await route.abort();
        return;
      }
      await route.continue();
    });
    await page
      .getByRole('button', { name: /Roadmap disponible: CC1002/ })
      .first()
      .click();
    await expect(page.getByRole('dialog', { name: 'Roadmap disponible: CC1002' })).toBeVisible();
    await page.getByRole('button', { name: 'Entendido' }).click();
    await expect(page.getByText('No se pudieron reconocer algunos avisos.')).toBeVisible();
    expect(
      (
        await (
          await request.get(`/api/notifications/counts?roadmapId=${roadmapId}`, { headers })
        ).json()
      ).count,
    ).toBe(12);
    const lateId = crypto.randomUUID();
    seed(lateId, "NOW() - INTERVAL '5 minutes'");

    failRecognition = false;
    await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
    await expect
      .poll(
        async () =>
          (
            await (
              await request.get(`/api/notifications/counts?roadmapId=${roadmapId}`, { headers })
            ).json()
          ).count,
      )
      .toBe(1);
    expect(
      (await (await request.get(`/api/notifications/${ids[11]}`, { headers })).json()).read,
    ).toBe(true);
    expect(
      (await (await request.get(`/api/notifications/${lateId}`, { headers })).json()).read,
    ).toBe(false);
  } finally {
    cleanup();
  }
});

test('Inbox query errors remain visible and can be retried', async ({ page }) => {
  await authenticateAs(page.context(), fixture.camila);
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

test('a PostgreSQL notification failure preserves the committed Roadmap and creation response', async ({
  request,
}) => {
  cleanupAvailabilityFixture();
  fixtureSql(`CREATE OR REPLACE FUNCTION e2e_reject_153_notice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'E2E notification failure'; END; $$;
    CREATE TRIGGER e2e_reject_153_notice BEFORE INSERT ON "RoadmapNotice" FOR EACH ROW EXECUTE FUNCTION e2e_reject_153_notice();`);
  try {
    const headers = { cookie: await sessionCookie(fixture.daniela) };
    const created = await request.post('/api/FI1001/2026/2/roadmap', { headers, data: {} });
    expect(created.status()).toBe(201);
    expect((await request.get('/api/FI1001/2026/2/roadmap', { headers })).status()).toBe(200);
    const recipient = { cookie: await sessionCookie(fixture.nicolas) };
    expect(
      (await (await request.get('/api/notifications', { headers: recipient })).json())
        .notifications,
    ).toHaveLength(0);
  } finally {
    fixtureSql(
      'DROP TRIGGER IF EXISTS e2e_reject_153_notice ON "RoadmapNotice"; DROP FUNCTION IF EXISTS e2e_reject_153_notice();',
    );
    cleanupAvailabilityFixture();
  }
});
