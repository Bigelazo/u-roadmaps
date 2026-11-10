import {
  currentAcademicTerm,
  fetchPublishedAcademicTerm,
} from '@/integrations/academic-calendar/server';

async function main() {
  if (process.argv.includes('--dry-run')) {
    const academicTerm = await fetchPublishedAcademicTerm(currentAcademicTerm());
    console.log(JSON.stringify(academicTerm, null, 2));
    return;
  }

  const { syncAcademicCalendar } = await import('@/features/roadmap/server');
  const { prisma } = await import('@/shared/server/db');
  try {
    const outcome = await syncAcademicCalendar({ force: true });
    if (outcome.status === 'synced') {
      console.log(
        `Calendario ${outcome.term.year}/${outcome.term.semester} sincronizado; congelación: ${outcome.term.roadmapFreezeDate}.`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
