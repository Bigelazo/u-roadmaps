import { seedPredefinedNodeTypes } from '@/development/server';
import { prisma } from '@/shared/server/db';

async function main() {
  await seedPredefinedNodeTypes();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
