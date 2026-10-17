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
  // Refresh stored roles on entry, as the course page does, so a deep link works;
  // an unavailable source preserves local access. The read itself never synchronises.
  await synchronizeParticipation(user, identifier, roadmapChangePort);
  // Students and outsiders get the same answer as a missing Course offering.
  const participants = await readCourseParticipants(user, identifier).catch((error: unknown) => {
    if (error instanceof ApplicationError && (error.status === 403 || error.status === 404))
      return null;
    throw error;
  });
  if (!participants) notFound();
  return <CourseParticipants participants={participants} />;
}
