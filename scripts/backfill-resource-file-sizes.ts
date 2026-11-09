import { backfillResourceFileSizes } from '@/features/roadmap/server';

async function main() {
  const { prisma } = await import('@/shared/server/db');
  try {
    const { measured, missing } = await backfillResourceFileSizes();
    console.log(`Tamaño registrado para ${measured} recursos de archivo.`);
    if (missing.length)
      console.warn(`Sin archivo en el almacenamiento: ${missing.length} recursos.`, missing);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
