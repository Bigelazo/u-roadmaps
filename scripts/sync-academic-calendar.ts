import { fetchPublishedAcademicTerm } from '@/integrations/academic-calendar/server';

type AcademicTermTarget = { year: number; semester: 1 | 2 };

function chileDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function targetTerm(now = new Date()): AcademicTermTarget {
  const { year, month } = chileDateParts(now);
  const numericMonth = Number(month);
  return {
    year: Number(year),
    semester: numericMonth >= 8 ? 2 : 1,
  };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    const academicTerm = await fetchPublishedAcademicTerm(targetTerm());
    console.log(JSON.stringify(academicTerm, null, 2));
    return;
  }

  const academicTerm = await fetchPublishedAcademicTerm(targetTerm());
  const { prisma } = await import('@/shared/server/db');
  try {
    const dateAtUtcMidday = (day: string) => new Date(`${day}T12:00:00.000Z`);
    await prisma.academicTerm.upsert({
      where: { year_semester: { year: academicTerm.year, semester: academicTerm.semester } },
      create: {
        ...academicTerm,
        lastClassDay: dateAtUtcMidday(academicTerm.lastClassDay),
        examStartDay: dateAtUtcMidday(academicTerm.examStartDay),
        examEndDay: dateAtUtcMidday(academicTerm.examEndDay),
        roadmapFreezeDate: dateAtUtcMidday(academicTerm.roadmapFreezeDate),
      },
      update: {
        lastClassDay: dateAtUtcMidday(academicTerm.lastClassDay),
        examStartDay: dateAtUtcMidday(academicTerm.examStartDay),
        examEndDay: dateAtUtcMidday(academicTerm.examEndDay),
        roadmapFreezeDate: dateAtUtcMidday(academicTerm.roadmapFreezeDate),
        sourcePageUrl: academicTerm.sourcePageUrl,
        sourcePdfUrl: academicTerm.sourcePdfUrl,
      },
    });
    console.log(
      `Calendario ${academicTerm.year}/${academicTerm.semester} sincronizado; congelación: ${academicTerm.roadmapFreezeDate}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
