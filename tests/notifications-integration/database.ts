import { Client } from 'pg';

export function integrationDatabaseUrl() {
  const connection = process.env.NOTIFICATIONS_DATABASE_URL;
  if (!connection) throw new Error('Set NOTIFICATIONS_DATABASE_URL in .env.');
  const url = new URL(connection);
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.pathname !== '/roadmap_notifications_test_db' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'Notifications tests require local roadmap_notifications_test_db without connection overrides.',
    );
  }
  return connection;
}

export function integrationClient(connection: string) {
  return new Client({
    connectionString: connection,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 10_000,
    lock_timeout: 5_000,
    query_timeout: 15_000,
  });
}

export async function cleanTestData(connection: string, code?: string, userIds?: string[]) {
  const client = integrationClient(connection);
  try {
    await client.connect();
    await client.query('BEGIN');
    const codes = code
      ? [code]
      : (
          await client.query('SELECT code FROM "Course" WHERE starts_with(code, $1)', ['NT-'])
        ).rows.map((row: { code: string }) => row.code);
    const users =
      userIds ??
      (
        await client.query('SELECT id FROM "User" WHERE "institutionalEmail" LIKE $1', [
          '%@notifications.u-roadmaps.test',
        ])
      ).rows.map((row: { id: string }) => row.id);
    await client.query(
      'DELETE FROM "NoticeAcknowledgement" WHERE "recipientId" = ANY($1::uuid[]) OR "roadmapId" IN (SELECT r.id FROM "Roadmap" r JOIN "CourseOffering" o ON o.id = r."courseOfferingId" WHERE o."courseCode" = ANY($2::text[]))',
      [users, codes],
    );
    await client.query(
      'DELETE FROM "RoadmapNotice" WHERE "courseOfferingId" IN (SELECT id FROM "CourseOffering" WHERE "courseCode" = ANY($1::text[]))',
      [codes],
    );
    await client.query('DELETE FROM "Course" WHERE code = ANY($1::text[])', [codes]);
    await client.query('DELETE FROM "User" WHERE id = ANY($1::uuid[])', [users]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}
