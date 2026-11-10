import { afterEach, expect, test } from 'vitest';
import { prisma } from '@/shared/server/db';
import { syncAcademicCalendar } from '@/features/roadmap/server';
import type {
  AcademicTermIdentifier,
  PublishedAcademicTerm,
} from '@/integrations/academic-calendar/server';

const term = { year: 1500, semester: 2 } as const;
const springOf1500 = new Date('1500-10-20T15:00:00.000Z');

function publishing(examEndDay: string) {
  const requested: AcademicTermIdentifier[] = [];
  const fetchTerm = async (identifier: AcademicTermIdentifier): Promise<PublishedAcademicTerm> => {
    requested.push(identifier);
    return {
      ...identifier,
      lastClassDay: '1500-11-28',
      examStartDay: '1500-11-30',
      examEndDay,
      roadmapFreezeDate: examEndDay,
      sourcePageUrl: 'https://ingenieria.uchile.cl/calendarios',
      sourcePdfUrl: 'https://ingenieria.uchile.cl/primavera-1500.pdf',
    };
  };
  return { requested, fetchTerm };
}

async function storedFreezeDate() {
  const stored = await prisma.academicTerm.findUnique({
    where: { year_semester: term },
    select: { roadmapFreezeDate: true },
  });
  return stored?.roadmapFreezeDate.toISOString().slice(0, 10);
}

afterEach(async () => {
  await prisma.academicTerm.deleteMany({ where: term });
});

test('stores the published dates of the current term', async () => {
  const published = publishing('1500-12-12');

  const outcome = await syncAcademicCalendar({
    now: springOf1500,
    fetchTerm: published.fetchTerm,
  });

  expect(outcome.status).toBe('synced');
  expect(published.requested).toEqual([term]);
  expect(await storedFreezeDate()).toBe('1500-12-12');
});

test('leaves a stored term untouched without downloading it again', async () => {
  await syncAcademicCalendar({
    fetchTerm: publishing('1500-12-12').fetchTerm,
    now: springOf1500,
  });
  const republished = publishing('1500-12-19');

  const outcome = await syncAcademicCalendar({
    now: new Date('1500-11-20T15:00:00.000Z'),
    fetchTerm: republished.fetchTerm,
  });

  expect(outcome.status).toBe('stored');
  expect(republished.requested).toEqual([]);
  expect(await storedFreezeDate()).toBe('1500-12-12');
});

test('a failed download keeps the stored dates', async () => {
  await syncAcademicCalendar({
    fetchTerm: publishing('1500-12-12').fetchTerm,
    force: true,
    now: springOf1500,
  });

  await expect(
    syncAcademicCalendar({
      now: springOf1500,
      force: true,
      fetchTerm: async () => {
        throw new Error('HTTP 503');
      },
    }),
  ).rejects.toThrow('HTTP 503');
  expect(await storedFreezeDate()).toBe('1500-12-12');
});

test('waits for the usual publication day before looking for the calendar', async () => {
  const published = publishing('1500-12-12');

  const beforeOctober15 = await syncAcademicCalendar({
    now: new Date('1500-10-15T03:00:00.000Z'),
    fetchTerm: published.fetchTerm,
  });
  expect(beforeOctober15.status).toBe('unpublished');
  expect(published.requested).toEqual([]);

  const onOctober15 = await syncAcademicCalendar({
    now: new Date('1500-10-15T05:00:00.000Z'),
    fetchTerm: published.fetchTerm,
  });
  expect(onOctober15.status).toBe('synced');
  expect(published.requested).toEqual([term]);
});

test('a manual sync does not wait for the publication day', async () => {
  const published = publishing('1500-12-12');

  const outcome = await syncAcademicCalendar({
    now: new Date('1500-08-01T15:00:00.000Z'),
    force: true,
    fetchTerm: published.fetchTerm,
  });

  expect(outcome.status).toBe('synced');
});
