import { execFileSync } from 'node:child_process';
import { cleanTestData, integrationClient, integrationDatabaseUrl } from './database';

export default async function setup() {
  const connection = integrationDatabaseUrl();
  const adminUrl = new URL(connection);
  adminUrl.pathname = '/postgres';
  const admin = integrationClient(adminUrl.toString());
  try {
    await admin.connect();
    const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      'roadmap_notifications_test_db',
    ]);
    if (!existing.rowCount) await admin.query('CREATE DATABASE roadmap_notifications_test_db');
  } finally {
    await admin.end();
  }
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: connection },
    stdio: 'inherit',
    timeout: 60_000,
  });
  await cleanTestData(connection);
}
