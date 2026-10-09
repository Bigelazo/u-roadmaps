import { notFound, redirect } from 'next/navigation';
import { PracticeRoadmapCanvas } from '@/features/roadmap';
import { readPracticeRoadmapCalendar, recordTutorialOpened } from '@/features/roadmap/server';
import { getApplicationSession, resolveSessionUser } from '@/shared/server/session';

export default async function PracticeRoadmapPage(
  props: PageProps<'/practice-roadmap/[experience]'>,
) {
  const { experience } = await props.params;
  if (experience !== 'student' && experience !== 'teaching') notFound();
  const { origin } = await props.searchParams;

  const user = await resolveSessionUser(await getApplicationSession());
  if (!user) redirect('/api/plogin/start');
  await recordTutorialOpened(user.id);
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
