import { afterAll } from 'vitest';
import { integrationDatabaseUrl } from './database';

process.env.DATABASE_URL = integrationDatabaseUrl();
afterAll(async () => {
  const { prisma } = await import('@/shared/server/db');
  await prisma.$disconnect();
});
