import { registerHooks } from 'node:module';
import { e2eDatabaseUrl } from './database';

registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(
      specifier === 'server-only' ? 'next/dist/compiled/server-only/empty.js' : specifier,
      context,
    ),
});

async function main() {
  if (process.env.DATABASE_URL !== e2eDatabaseUrl())
    throw new Error('The scheduled unlock release must run against the E2E database.');
  const now = new Date(process.argv[2] ?? '');
  if (Number.isNaN(now.getTime())) throw new Error('Pass the release instant as an ISO date.');
  const { releaseDueScheduledUnlocks } = await import('@/app/_adapters/scheduled-unlock-release');
  const { prisma } = await import('@/shared/server/db');
  try {
    await releaseDueScheduledUnlocks(now);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
