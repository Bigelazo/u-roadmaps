import { notFound, redirect } from 'next/navigation';
import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { CourseParticipants, parseCourseOfferingIdentifier } from '@/features/roadmap';
import { readCourseParticipants, synchronizeParticipation } from '@/features/roadmap/server';
import { ApplicationError } from '@/shared/errors/server';
import { getApplicationSession, resolveSessionUser } from '@/shared/server/session';

export default async function CourseParticipantsPage(
  props: PageProps<'/courses/[courseCode]/[year]/[semester]/participants'>,
) {
  const identifier = parseCourseOfferingIdentifier(await props.params);
  if (!identifier) notFound();
  const user = await resolveSessionUser(await getApplicationSession());
  if (!user) redirect('/api/plogin/start');
  await synchronizeParticipation(user, identifier, roadmapChangePort);
  const participants = await readCourseParticipants(user, identifier).catch((error: unknown) => {
    if (error instanceof ApplicationError && (error.status === 403 || error.status === 404))
      return null;
    throw error;
  });
  if (!participants) notFound();
  return <CourseParticipants participants={participants} />;
}
