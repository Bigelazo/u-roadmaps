import { notFound, redirect } from 'next/navigation';
import { PracticeRoadmapCanvas } from '@/features/roadmap';
import { isPracticeExperience, readPracticeRoadmapCalendar } from '@/features/roadmap/server';
import { getApplicationSession } from '@/shared/server/session';
import { resolveSessionUser } from '@/app/_adapters/auth';

export default async function PracticeRoadmapPage(
  props: PageProps<'/practice-roadmap/[experience]'>,
) {
  const { experience } = await props.params;
  if (!isPracticeExperience(experience)) notFound();
  const { origin } = await props.searchParams;

  const user = await resolveSessionUser(await getApplicationSession());
  if (!user) redirect('/api/plogin/start');
  const { term, today } = await readPracticeRoadmapCalendar();

  return (
    <PracticeRoadmapCanvas
      experience={experience}
      term={term}
      today={today}
      origin={typeof origin === 'string' ? origin : null}
    />
  );
}
