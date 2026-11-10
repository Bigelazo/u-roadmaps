import 'server-only';

import { prisma } from '@/shared/server/db';
import {
  currentAcademicTerm,
  fetchPublishedAcademicTerm,
  isCalendarExpectedPublished,
  type AcademicTermIdentifier,
  type PublishedAcademicTerm,
} from '@/integrations/academic-calendar/server';

export type AcademicCalendarSync =
  | { status: 'synced'; term: PublishedAcademicTerm }
  | { status: 'stored'; term: AcademicTermIdentifier }
  | { status: 'unpublished'; term: AcademicTermIdentifier };

function dateAtUtcMidday(day: string) {
  return new Date(`${day}T12:00:00.000Z`);
}

async function isStored(term: AcademicTermIdentifier) {
  const stored = await prisma.academicTerm.findUnique({
    where: { year_semester: term },
    select: { year: true },
  });
  return stored !== null;
}

export async function syncAcademicCalendar({
  now = new Date(),
  force = false,
  fetchTerm = fetchPublishedAcademicTerm,
}: {
  now?: Date;
  force?: boolean;
  fetchTerm?: (term: AcademicTermIdentifier) => Promise<PublishedAcademicTerm>;
} = {}): Promise<AcademicCalendarSync> {
  const term = currentAcademicTerm(now);
  if (!force && !isCalendarExpectedPublished(term, now)) {
    return { status: 'unpublished', term };
  }
  if (!force && (await isStored(term))) {
    return { status: 'stored', term };
  }

  const published = await fetchTerm(term);
  const dates = {
    lastClassDay: dateAtUtcMidday(published.lastClassDay),
    examStartDay: dateAtUtcMidday(published.examStartDay),
    examEndDay: dateAtUtcMidday(published.examEndDay),
    roadmapFreezeDate: dateAtUtcMidday(published.roadmapFreezeDate),
    sourcePageUrl: published.sourcePageUrl,
    sourcePdfUrl: published.sourcePdfUrl,
  };
  await prisma.academicTerm.upsert({
    where: { year_semester: { year: published.year, semester: published.semester } },
    create: { year: published.year, semester: published.semester, ...dates },
    update: dates,
  });
  return { status: 'synced', term: published };
}
