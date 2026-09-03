import { assertFixtureEnvironment, resetDevelopmentData } from '@/development/server';

async function main() {
  await assertFixtureEnvironment();
  if (process.argv.includes('--assert-environment')) return;

  const { prisma } = await import('@/shared/server/db');
  try {
    await resetDevelopmentData();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
